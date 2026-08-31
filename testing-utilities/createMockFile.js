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
// A MOCK FILE THE CLIENT CAN SEND. This used to return a BUFFER, which the SystemLynx client cannot
// upload — its convertToReadStream() takes a Readable or a path and throws on anything else — so a
// CLI test with `files: ["mockFile(test.png)"]` died before any multipart was built and the method
// saw a stripped argument (buAPI's report: `{ sender }` only, no message, no files; the UI passed
// because a browser hands over a real File). It also wrote the mock into the CURRENT DIRECTORY.
// Now: the mock lives in the OS temp folder and comes back as a read stream WITH a `.path`, which
// is what the client wants and what the multipart filename is taken from.
const os = require("os");
const path = require("path");
module.exports = function createMockFile(fileName) {
  const clean = path.basename(String(fileName || "").trim());
  const fileParts = clean.split(".");
  const fileExtension = fileParts.pop();
  const fileNameWithoutExtension = fileParts.join(".");
  if (!fileTypes[fileExtension]) return null;
  const dir = path.join(os.tmpdir(), "systemview-mocks");
  try { fs.mkdirSync(dir, { recursive: true }); } catch {}
  const full = path.join(dir, clean);
  fs.writeFileSync(full, `Mock content for ${fileNameWithoutExtension}.${fileExtension}`);
  return fs.createReadStream(full);
};
