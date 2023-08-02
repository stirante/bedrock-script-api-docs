import fs from 'fs';
import path from 'path';


function copyFolderSync(src, dest) {
  // Check if the source folder exists
  if (!fs.existsSync(src)) {
    console.error(`Source folder ${src} doesn't exist.`);
    return;
  }

  // Create the destination folder if it doesn't exist
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  // Read the contents of the source folder
  const entries = fs.readdirSync(src, { withFileTypes: true });

  // Iterate over each entry (file or folder) and copy it
  entries.forEach((entry) => {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      // If the entry is a folder, call the function recursively
      copyFolderSync(srcPath, destPath);
    } else {
      // If the entry is a file, copy the file
      fs.copyFileSync(srcPath, destPath);
    }
  });
}

export { copyFolderSync };