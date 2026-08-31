// The upload leg, dogfooded. `files` arrives as the server's multer objects (originalname, size,
// path) once the client has sent them as multipart — which is the path a CLI test with
// `files: ["mockFile(test.png)"]` exercises. Nothing is kept; the server clears its temp folder.
module.exports = {
  upload({ note, files } = {}) {
    const list = Array.isArray(files) ? files : [];
    this.log("upload called", { note, count: list.length });
    return {
      note: note || "",
      count: list.length,
      names: list.map((f) => f.originalname || f.filename || "").filter(Boolean),
      bytes: list.reduce((n, f) => n + (Number(f.size) || 0), 0),
    };
  },
};
