const express = require("express");
const axios = require("axios");
const path = require("path");
const ejs = require("ejs");
const fs = require("fs");
const app = express();
app.use(express.static("public"));
require("dotenv").config();
const { parse } = require("pg-connection-string");
const { Pool } = require("pg");

const config = parse(process.env.DATABASE_URL);
const MERRIAM_WEBSTER_API_KEY = process.env.MERRIAM_WEBSTER_API_KEY;
const API_KEY = process.env.API_KEY;

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
         antonyms TEXT NOT NULL,
         partOfSpeech TEXT NOT NULL
      );
            
      CREATE TABLE IF NOT EXISTS recent_searches (
        id SERIAL PRIMARY KEY,
        term TEXT NOT NULL
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

app.get("/", async (req, res) => {
  const popularSearches = Object.entries(searchCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_POPULAR_SEARCHES)
    .map((entry) => entry[0]);

  try {
    const dbResponse = await pool.query(
      "SELECT term FROM terms ORDER BY RANDOM() LIMIT 1"
    );
    if (dbResponse.rows.length > 0) {
      randomWord = dbResponse.rows[0].term;
    }
  } catch (error) {
    console.error(error);
  }

  // Render the index.ejs template with the updated randomWord value
  res.render("index", {
    recentSearches,
    popularSearches,
    searchCounts,
    randomWord,
  });
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
        meanings: [
          { definitions: definitions, partOfSpeech: dbData.partOfSpeech },
        ],
        thesaurusData: [{ meta: { syns: [synonyms], ants: [antonyms] } }],
        recentSearches: recentSearches,
      });
    } else {
      // If term doesn't exist in the database, redirect to the search route
      res.redirect(`/?word=${encodeURIComponent(word)}`);
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("An error occurred while fetching the data.");
  }
});
const updateSearches = async (word) => {
  if (!recentSearches.includes(word)) {
    recentSearches.unshift(word);
    if (recentSearches.length > MAX_RECENT_SEARCHES) {
      recentSearches.pop();
    }
  }

  try {
    await pool.query("INSERT INTO recent_searches (term) VALUES ($1)", [word]);
    console.log("Recent search term saved to the database.");
  } catch (err) {
    console.error(err.stack);
  }

  // Increment search count for the word
  if (searchCounts[word]) {
    searchCounts[word]++;
  } else {
    searchCounts[word] = 1;
  }
};

const saveTerm = async (term, definition, synonyms, antonyms, partOfSpeech) => {
  try {
    const res = await pool.query(
      `INSERT INTO terms(term, definition, synonyms, antonyms, partOfSpeech)
       SELECT $1, $2, $3, $4, $5
       WHERE NOT EXISTS (SELECT 1 FROM terms WHERE term = $1)
       RETURNING *`,
      [term, definition, synonyms, antonyms, partOfSpeech]
    );

    if (res.rows.length > 0) {
      console.log("Term saved to the database.");
    } else {
      console.log("Term already exists in the database.");
    }
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
      `https://www.dictionaryapi.com/api/v3/references/collegiate/json/${word}?key=${MERRIAM_WEBSTER_API_KEY}`
    );
    const data = response.data[0];

    let definitions = [];
    let partOfSpeech = "";

    if (data.fl) {
      partOfSpeech = data.fl; // field name is 'fl' for partOfSpeech
    }

    if (data.shortdef) {
      definitions = data.shortdef.join(", "); // 'shortdef' is the correct field name for definitions
    }

    const thesaurusResponse = await axios.get(
      `https://www.dictionaryapi.com/api/v3/references/thesaurus/json/${word}?key=${API_KEY}`
    );
    const thesaurusData = thesaurusResponse.data[0];

    let synonyms = "No synonyms found";
    let antonyms = "No antonyms found";

    if (thesaurusData.meta && thesaurusData.meta.syns[0]) {
      synonyms = thesaurusData.meta.syns[0].slice(0, 5).join(", "); // Get the first 5 synonyms
    }
    if (thesaurusData.meta && thesaurusData.meta.ants[0]) {
      antonyms = thesaurusData.meta.ants[0].slice(0, 5).join(", "); // Get the first 5 antonyms
    }

    saveTerm(word, definitions, synonyms, antonyms, partOfSpeech);
    updateSearches(word);

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
