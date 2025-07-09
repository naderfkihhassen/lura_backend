/* eslint-disable prettier/prettier */
import * as fs from 'fs';
import * as path from 'path';

function checkUploadsDirectory() {
  const uploadsDir = path.join(process.cwd(), 'uploads');

  console.log(`Checking uploads directory at: ${uploadsDir}`);

  if (!fs.existsSync(uploadsDir)) {
    console.log('Uploads directory does not exist, creating it...');
    try {
      fs.mkdirSync(uploadsDir, { recursive: true });
      console.log('Uploads directory created successfully');
    } catch (error) {
      console.error('Error creating uploads directory:', error);
      return;
    }
  } else {
    console.log('Uploads directory already exists');
  }

  // Check write permissions
  try {
    const testFile = path.join(uploadsDir, 'test-write-permission.txt');
    fs.writeFileSync(testFile, 'test');
    console.log(
      'Successfully wrote test file, directory has write permissions',
    );
    fs.unlinkSync(testFile);
    console.log('Successfully removed test file');
  } catch (error) {
    console.error('Error testing write permissions:', error);
  }

  // List directory contents
  try {
    const files = fs.readdirSync(uploadsDir);
    console.log(`Directory contents (${files.length} files):`);
    files.forEach((file) => {
      const filePath = path.join(uploadsDir, file);
      const stats = fs.statSync(filePath);
      console.log(
        `- ${file} (${stats.size} bytes, ${stats.isDirectory() ? 'directory' : 'file'})`,
      );
    });
  } catch (error) {
    console.error('Error listing directory contents:', error);
  }
}

checkUploadsDirectory();
