const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTx() {
  const tx = await prisma.paymentTransaction.findFirst({
    where: { gatewayReference: 'T874373592120478' },
    include: { creator: true }
  });
  console.log('Transaction:', JSON.stringify(tx, null, 2));

  const wallet = await prisma.creatorWallet.findFirst({
    where: { creatorId: tx?.creatorId }
  });
  console.log('Wallet:', JSON.stringify(wallet, null, 2));
}

checkTx().catch(console.error).finally(() => prisma.$disconnect());
