const express = require("express");
const axios = require("axios");
const path = require("path");
const ejs = require("ejs");
const fs = require("fs");
const app = express();
require("dotenv").config();
const { parse } = require("pg-connection-string");
const { Pool } = require("pg");

const config = parse(process.env.DATABASE_URL);
config.ssl = { rejectUnauthorized: false };

const pool = new Pool(config);

const connectionString = process.env.DATABASE_URL;

pool.on("error", (err, client) => {
  console.error("Unexpected error on idle client", err);
  process.exit(-1);
});

const port = process.env.PORT || 3000;

const createTermsTable = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS terms (
         id SERIAL PRIMARY KEY,
         term TEXT NOT NULL,
         definition TEXT NOT NULL,
         synonyms TEXT NOT NULL,
         antonyms TEXT NOT NULL
      );
    `);
    console.log("Terms table created or already exists.");
  } catch (err) {
    console.error(err.stack);
  }
};

const initializeDatabase = async () => {
  try {
    await createTermsTable();
    console.log("Database initialization completed.");
  } catch (err) {
    console.error("Database initialization failed: ", err.stack);
    process.exit(1); // Exit the process with an error code
  }
};

// Call the function to initialize the database when the application starts
initializeDatabase();

if (process.env.NODE_ENV === "production") {
  app.use((req, res, next) => {
    if (req.headers["x-forwarded-proto"] != "https") {
      res.redirect(`https://${req.headers.host}${req.url}`);
    } else {
      next();
    }
  });
}

const MAX_RECENT_SEARCHES = 5;
const MAX_POPULAR_SEARCHES = 5; // Maximum number of popular searches to display
let recentSearches = [];
let searchCounts = {};

const publicPath = path.join(__dirname, "public");
const termPath = path.join(publicPath, "term");

app.use(express.urlencoded({ extended: false }));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Generate dynamic sitemap based on terms in the database
const generateSitemap = async () => {
  try {
    const dbResponse = await pool.query("SELECT term FROM terms");
    const terms = dbResponse.rows.map((row) => row.term);
    const urls = terms.map((term) => {
      return `https://dictionaryyy.com/term/${encodeURIComponent(term)}`;
    });
    const sitemap = urls
      .map((url) => `<url><loc>${url}</loc></url>`)
      .join("\n");
    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemap}
</urlset>`;
  } catch (err) {
    console.error(err.stack);
    return null;
  }
};

// Generate a sorted array of terms in the database
const getSortedTerms = async () => {
  try {
    const dbResponse = await pool.query("SELECT term FROM terms ORDER BY term");
    return dbResponse.rows.map((row) => row.term);
  } catch (err) {
    console.error(err.stack);
    return [];
  }
};

app.get("/", (req, res) => {
  const popularSearches = Object.entries(searchCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_POPULAR_SEARCHES)
    .map((entry) => entry[0]);
  res.render("index", { recentSearches, popularSearches, searchCounts });
});

app.get("/term/:word", async (req, res) => {
  const word = req.params.word;

  try {
    // Fetch term from the database
    const dbResponse = await pool.query("SELECT * FROM terms WHERE term = $1", [
      word,
    ]);
    const dbData = dbResponse.rows[0];

    if (dbData) {
      // If term exists in the database, render the page with the database data
      let synonyms = dbData.synonyms.split(", ");
      let antonyms = dbData.antonyms.split(", "); // Assuming antonyms are split with comma
      let definitions = dbData.definition
        .split(", ")
        .map((def) => ({ definition: def }));

      res.render("definition", {
        word: word,
        meanings: [{ definitions: definitions, partOfSpeech: "N/A" }], // Assuming partOfSpeech as 'N/A' for simplicity
        thesaurusData: [{ meta: { syns: [synonyms], ants: [antonyms] } }], // Assuming antonyms need to be displayed
        recentSearches: recentSearches,
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("An error occurred while fetching the data.");
  }
});

const updateSearches = (word) => {
  if (!recentSearches.includes(word)) {
    recentSearches.unshift(word);
    if (recentSearches.length > MAX_RECENT_SEARCHES) {
      recentSearches.pop();
    }
  }

  // Increment search count for the word
  if (searchCounts[word]) {
    searchCounts[word]++;
  } else {
    searchCounts[word] = 1;
  }
};

const saveTerm = async (term, definition, synonyms, antonyms) => {
  try {
    const res = await pool.query(
      "INSERT INTO terms(term, definition, synonyms, antonyms) VALUES($1, $2, $3, $4) RETURNING *",
      [term, definition, synonyms, antonyms]
    );
    console.log(res.rows[0]);
  } catch (err) {
    console.log(err.stack);
  }
};

app.get("/glossary", async (req, res) => {
  const terms = await getSortedTerms();
  res.render("glossary", { terms });
});

app.get("/sitemap.xml", async (req, res) => {
  const sitemap = await generateSitemap();
  if (sitemap) {
    res.header("Content-Type", "application/xml");
    res.send(sitemap);
  } else {
    res.status(500).send("An error occurred while generating the sitemap.");
  }
});

app.post("/", async (req, res, next) => {
  const word = req.body.word.toLowerCase();
  try {
    const response = await axios.get(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${word}`
    );
    const data = response.data[0];

    let definitions = [];
    data.meanings.forEach((item) => {
      item.definitions.forEach((def) => {
        definitions.push(def.definition);
      });
    });
    definitions = definitions.join(", ");

    const thesaurusResponse = await axios.get(
      `https://dictionaryapi.com/api/v3/references/thesaurus/json/${word}?key=7085ae97-a37c-4ad1-a6d1-ef26c269158d`
    );
    const thesaurusData = thesaurusResponse.data[0];

    let synonyms = thesaurusData.meta.syns.join(", ");
    let antonyms = thesaurusData.meta.ants.join(", ");

    saveTerm(word, definitions, synonyms, antonyms);

    res.redirect(`/term/${word}`);
  } catch (error) {
    console.error(error);
    return next(error);
  }
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send("An internal server error occurred");
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
