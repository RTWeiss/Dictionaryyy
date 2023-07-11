document
  .getElementById("searchForm")
  .addEventListener("submit", function (event) {
    event.preventDefault();
    getDefinition();
  });

async function getDefinition() {
  const word = document.getElementById("searchBox").value;
  const resultDiv = document.getElementById("result");

  try {
    const response = await fetch(`/api/definition/${word}`);
    const data = await response.json();

    if (Array.isArray(data) && data.length > 0) {
      resultDiv.innerText = "";
      data[0].meanings.forEach((meaning) => {
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
    } else {
      resultDiv.innerText = "No definition found.";
    }
  } catch (error) {
    console.error("Error:", error);
    resultDiv.innerText = "Error retrieving definition.";
  }
}
