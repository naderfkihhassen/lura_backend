import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Support both Windows and Unix style prefixes
  const prefixes = [
    'E:/lura/backend/api/',
    'E:\\lura\\backend\\api\\',
    '/home/youruser/lura/backend/api/', // Add more if needed
  ]
  let totalUpdated = 0;
  for (const prefix of prefixes) {
    const documents = await prisma.document.findMany({
      where: {
        path: {
          startsWith: prefix,
        },
      },
    })
    if (documents.length === 0) {
      console.log(`No documents found with prefix: ${prefix}`)
      continue;
    }
    for (const doc of documents) {
      const newPath = doc.path.replace(prefix, '')
      await prisma.document.update({
        where: { id: doc.id },
        data: { path: newPath },
      })
      console.log(`Updated document ${doc.id}: ${doc.path} -> ${newPath}`)
      totalUpdated++;
    }
  }
  if (totalUpdated === 0) {
    console.log('No document paths needed updating.')
  } else {
    console.log(`All document paths updated. Total: ${totalUpdated}`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  }) 