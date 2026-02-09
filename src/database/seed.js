const bcrypt = require('bcryptjs');
const prisma = require('../config/database');

async function seed() {
  console.log('Seeding database...');

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { phoneNumber: '+9779800000000' },
    update: {},
    create: {
      phoneNumber: '+9779800000000',
      name: 'Admin User',
      role: 'ADMIN',
      passwordHash: adminPassword,
      businessName: 'Khaacho Admin',
    },
  });

  console.log('Admin created/found:', admin.phoneNumber);

  // Create sample vendor
  const vendorPassword = await bcrypt.hash('vendor123', 12);
  const vendorUser = await prisma.user.upsert({
    where: { phoneNumber: '+9779800000001' },
    update: {},
    create: {
      phoneNumber: '+9779800000001',
      name: 'Sample Vendor',
      role: 'VENDOR',
      passwordHash: vendorPassword,
      businessName: 'ABC Wholesale',
      address: 'Surkhet, Nepal',
    },
  });

  const vendor = await prisma.vendor.upsert({
    where: { userId: vendorUser.id },
    update: {},
    create: {
      userId: vendorUser.id,
      vendorCode: 'VEN001',
      creditLimit: 1000000,
    },
  });

  console.log('Vendor created/found:', vendorUser.phoneNumber);

  // Create sample products
  const product1 = await prisma.product.upsert({
    where: { productCode: 'RICE-1KG' },
    update: {},
    create: {
      productCode: 'RICE-1KG',
      name: 'Rice (1kg)',
      unit: 'kg',
      category: 'Grains',
    },
  });

  const product2 = await prisma.product.upsert({
    where: { productCode: 'DAL-1KG' },
    update: {},
    create: {
      productCode: 'DAL-1KG',
      name: 'Dal (1kg)',
      unit: 'kg',
      category: 'Pulses',
    },
  });

  const product3 = await prisma.product.upsert({
    where: { productCode: 'OIL-1L' },
    update: {},
    create: {
      productCode: 'OIL-1L',
      name: 'Oil (1L)',
      unit: 'liter',
      category: 'Cooking Oil',
    },
  });

  // Create vendor products
  await prisma.vendorProduct.upsert({
    where: { sku: 'VEN001-RICE-1KG' },
    update: {},
    create: {
      vendorId: vendor.id,
      productId: product1.id,
      sku: 'VEN001-RICE-1KG',
      vendorPrice: 80,
      mrp: 90,
      stock: 1000,
    },
  });

  await prisma.vendorProduct.upsert({
    where: { sku: 'VEN001-DAL-1KG' },
    update: {},
    create: {
      vendorId: vendor.id,
      productId: product2.id,
      sku: 'VEN001-DAL-1KG',
      vendorPrice: 120,
      mrp: 135,
      stock: 500,
    },
  });

  await prisma.vendorProduct.upsert({
    where: { sku: 'VEN001-OIL-1L' },
    update: {},
    create: {
      vendorId: vendor.id,
      productId: product3.id,
      sku: 'VEN001-OIL-1L',
      vendorPrice: 200,
      mrp: 220,
      stock: 300,
    },
  });

  console.log('Products created/found: 3');

  // Create sample retailer
  const retailerPassword = await bcrypt.hash('retailer123', 12);
  const retailerUser = await prisma.user.upsert({
    where: { phoneNumber: '+9779800000002' },
    update: {},
    create: {
      phoneNumber: '+9779800000002',
      name: 'Sample Retailer',
      role: 'RETAILER',
      passwordHash: retailerPassword,
      businessName: 'XYZ Store',
      address: 'Birendranagar, Surkhet',
    },
  });

  await prisma.retailer.upsert({
    where: { userId: retailerUser.id },
    update: {},
    create: {
      userId: retailerUser.id,
      retailerCode: 'RET001',
      shopName: 'XYZ Store',
    },
  });

  console.log('Retailer created/found:', retailerUser.phoneNumber);
  console.log('Seeding completed!');
}

seed()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
