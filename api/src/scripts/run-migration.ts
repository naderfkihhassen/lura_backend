/* eslint-disable prettier/prettier */
import { PrismaClient } from '@prisma/client';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function runMigration() {
  console.log('Starting migration process...');

  try {
    // Run prisma migrate
    console.log('Running prisma migrate...');
    const { stdout, stderr } = await execAsync(
      'npx prisma migrate dev --name add_comments',
    );

    if (stderr) {
      console.error('Migration stderr:', stderr);
    }

    console.log('Migration stdout:', stdout);
    console.log('Migration completed successfully');

    // Verify the schema
    const prisma = new PrismaClient();
    await prisma.$connect();

    // Check if Comment table exists
    try {
      const tableInfo = await prisma.$queryRaw`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'Comment'
      `;
      console.log('Table info:', tableInfo);
    } catch (e) {
      console.error('Error checking table:', e);
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

runMigration()
  .then(() => console.log('Process completed'))
  .catch((e) => console.error('Process failed:', e));
