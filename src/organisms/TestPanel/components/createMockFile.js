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

export default function createMockFile(fileName) {
  // Split the file name and extension
  const fileParts = fileName.split(".");
  const fileExtension = fileParts.pop();
  const fileNameWithoutExtension = fileParts.join(".");

  if (fileTypes[fileExtension]) {
    // Create a new Blob object with your mock file content
    const fileContent = `Mock content for ${fileNameWithoutExtension}.${fileExtension}`;
    const blob = new Blob([fileContent], { type: fileTypes[fileExtension] });

    // Create a new File object using the Blob
    const mockFile = new File([blob], fileName, { type: fileTypes[fileExtension] });

    return mockFile;
  }

  return `ERROR: Invalid file extension -> ${fileExtension}`;
}
