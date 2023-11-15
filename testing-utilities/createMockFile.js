const fs = require("fs");
const fileTypes = {
  txt: "text/plain",
  csv: "text/csv",
  json: "application/json",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  svg: "image/svg+xml",
};
module.exports = function createMockFile(fileName) {
  // Split the file name and extension
  const fileParts = fileName.split(".");
  const fileExtension = fileParts.pop();
  const fileNameWithoutExtension = fileParts.join(".");

  if (fileTypes[fileExtension]) {
    const fileContent = `Mock content for ${fileNameWithoutExtension}.${fileExtension}`;
    fs.writeFileSync(fileName, fileContent);
    return fs.readFileSync(fileName);
  } else {
    return null;
  }
};
