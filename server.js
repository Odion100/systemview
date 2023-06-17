const express = require("express");
const path = require("path");

const app = express();
const buildPath = path.join(__dirname, "build");
const indexPath = path.join(buildPath, "index.html");

app.use(express.static(buildPath));

// Route handler for all requests
app.get("*", (req, res) => {
  res.sendFile(indexPath);
});

// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`App is running on port ${port}`);
});
