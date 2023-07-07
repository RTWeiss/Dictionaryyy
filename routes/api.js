const express = require("express");
const axios = require("axios");
const router = express.Router();

router.get("/definition/:word", async (req, res) => {
  const word = req.params.word;

  try {
    const response = await axios.get(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${word}`
    );
    const data = response.data;

    // send the data to the client
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).send("An error occurred");
  }
});

module.exports = router;
