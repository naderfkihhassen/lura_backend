/* eslint-disable prettier/prettier */
import { PrismaClient } from '@prisma/client';

async function checkSchema() {
  const prisma = new PrismaClient();

  try {
    console.log('Connecting to database...');
    await prisma.$connect();
    console.log('Connected successfully');

    // Check if Comment table exists
    try {
      console.log('Checking Comment table...');
      const comments = await prisma.comment.findMany({
        take: 1,
      });
      console.log('Comment table exists, found:', comments.length, 'comments');
    } catch (e) {
      console.error('Error checking Comment table:', e);
    }

    // Check Document table
    try {
      console.log('Checking Document table...');
      const documents = await prisma.document.findMany({
        take: 5,
        include: {
          tags: true,
        },
      });
      console.log(
        'Document table exists, found:',
        documents.length,
        'documents',
      );
      if (documents.length > 0) {
        console.log('Sample document:', JSON.stringify(documents[0], null, 2));
      }
    } catch (e) {
      console.error('Error checking Document table:', e);
    }

    // Check Case table
    try {
      console.log('Checking Case table...');
      const cases = await prisma.case.findMany({
        take: 5,
        include: {
          documents: true,
        },
      });
      console.log('Case table exists, found:', cases.length, 'cases');
      if (cases.length > 0) {
        console.log('Sample case:', JSON.stringify(cases[0], null, 2));
      }
    } catch (e) {
      console.error('Error checking Case table:', e);
    }
  } catch (e) {
    console.error('Database connection error:', e);
  } finally {
    await prisma.$disconnect();
    console.log('Disconnected from database');
  }
}

checkSchema()
  .then(() => console.log('Schema check completed'))
  .catch((e) => console.error('Schema check failed:', e));
