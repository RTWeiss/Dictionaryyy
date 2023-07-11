document.addEventListener("DOMContentLoaded", function () {
  const client = algoliasearch(
    "G2APVHL6O1",
    "597c24fa42e31685dac485baf6a8118e"
  );
  const index = client.initIndex("terms");

  //initialize autocomplete on searchBox
  autocomplete("#searchBox", { hint: false }, [
    {
      source: autocomplete.sources.hits(index, { hitsPerPage: 5 }),
      displayKey: "word",
      templates: {
        suggestion: function (suggestion) {
          return suggestion._highlightResult.word.value;
        },
      },
    },
  ]).on("autocomplete:selected", async function (event, suggestion, dataset) {
    if (suggestion.meanings && suggestion.meanings.length > 0) {
      displayDefinition(suggestion); // display the definition from Algolia when a suggestion is selected
    } else {
      await getDefinition(suggestion.word); // Fetch definition from your API if the definition is not present in Algolia
    }
  });
});

async function getDefinition(word) {
  const resultDiv = document.getElementById("result");
  try {
    const response = await fetch(`/api/definition/${word}`);
    const data = await response.json();

    if (Array.isArray(data) && data.length > 0) {
      displayDefinition(data[0]); // display the definition from your API
    } else {
      resultDiv.innerText = "No definition found.";
    }
  } catch (error) {
    console.error("Error:", error);
    resultDiv.innerText = "Error retrieving definition.";
  }
}

function displayDefinition(item) {
  const resultDiv = document.getElementById("result");
  resultDiv.innerText = ""; // clear the resultDiv

  item.meanings.forEach((meaning) => {
    const div = document.createElement("div");
    div.classList.add("meaning");

    const header = document.createElement("h3");
    header.classList.add("partOfSpeech");
    header.innerText = `${meaning.partOfSpeech}`;
    div.appendChild(header);

    meaning.definitions.forEach((def) => {
      const p = document.createElement("p");
      p.innerText = def.definition;
      div.appendChild(p);

      if (def.example) {
        const example = document.createElement("p");
        example.innerText = `Example: ${def.example}`;
        example.style.fontStyle = "italic";
        div.appendChild(example);
      }
    });

    resultDiv.appendChild(div);
  });
}
