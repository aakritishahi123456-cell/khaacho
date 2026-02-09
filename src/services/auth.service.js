const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const config = require('../config');
const { AuthenticationError, ConflictError } = require('../utils/errors');

class AuthService {
  async register(userData) {
    const { phoneNumber, password, name, role, businessName, address } = userData;

    const existingUser = await prisma.user.findUnique({
      where: { phoneNumber },
    });

    if (existingUser) {
      throw new ConflictError('Phone number already registered');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        phoneNumber,
        passwordHash,
        name,
        role,
        businessName,
        address,
      },
      select: {
        id: true,
        phoneNumber: true,
        name: true,
        role: true,
        businessName: true,
      },
    });

    // Create role-specific profile
    if (role === 'VENDOR') {
      await prisma.vendor.create({
        data: { userId: user.id },
      });
    } else if (role === 'RETAILER') {
      await prisma.retailer.create({
        data: {
          userId: user.id,
          shopName: businessName || name,
        },
      });
    }

    const token = this.generateToken(user.id);
    return { user, token };
  }

  async login(phoneNumber, password) {
    const user = await prisma.user.findUnique({
      where: { phoneNumber },
    });

    if (!user || !user.isActive) {
      throw new AuthenticationError('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    
    if (!isPasswordValid) {
      throw new AuthenticationError('Invalid credentials');
    }

    const token = this.generateToken(user.id);
    
    return {
      user: {
        id: user.id,
        phoneNumber: user.phoneNumber,
        name: user.name,
        role: user.role,
      },
      token,
    };
  }

  generateToken(userId) {
    return jwt.sign({ userId }, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    });
  }
}

module.exports = new AuthService();
