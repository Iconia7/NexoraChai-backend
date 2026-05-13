import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
    console.log('Models available on prisma object:');
    const keys = Object.keys(prisma).filter(k => !k.startsWith('$') && !k.startsWith('_'));
    console.log(keys);
    process.exit(0);
}

check();
