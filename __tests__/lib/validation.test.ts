/**
 * Tests for validation schemas
 */

import { describe, it, expect } from '@jest/globals'
import { 
  loginSchema, 
  registerSchema, 
  changePasswordSchema,
  passwordSchema 
} from '@/lib/validation'

describe('Password Validation', () => {
  it('should reject passwords shorter than 8 characters', () => {
    expect(() => passwordSchema.parse('short')).toThrow()
    expect(() => passwordSchema.parse('1234567')).toThrow()
  })

  it('should require lowercase letters', () => {
    expect(() => passwordSchema.parse('PASSWORD123')).toThrow()
  })

  it('should require uppercase letters', () => {
    expect(() => passwordSchema.parse('password123')).toThrow()
  })

  it('should require numbers', () => {
    expect(() => passwordSchema.parse('Password')).toThrow()
  })

  it('should accept valid passwords', () => {
    expect(() => passwordSchema.parse('Password123')).not.toThrow()
    expect(() => passwordSchema.parse('MyP@ssw0rd')).not.toThrow()
  })
})

describe('Login Schema', () => {
  it('should validate correct login data', () => {
    const result = loginSchema.parse({
      email: 'test@example.com',
      password: 'anypassword',
    })
    expect(result.email).toBe('test@example.com')
  })

  it('should reject invalid email', () => {
    expect(() => loginSchema.parse({
      email: 'invalid-email',
      password: 'password',
    })).toThrow()
  })
})

describe('Register Schema', () => {
  it('should validate correct registration data', () => {
    const result = registerSchema.parse({
      email: 'test@example.com',
      password: 'Password123',
      name: 'Test User',
    })
    expect(result.email).toBe('test@example.com')
    expect(result.name).toBe('Test User')
  })

  it('should enforce password policy', () => {
    expect(() => registerSchema.parse({
      email: 'test@example.com',
      password: 'weak',
      name: 'Test User',
    })).toThrow()
  })
})

describe('Change Password Schema', () => {
  it('should validate matching passwords', () => {
    const result = changePasswordSchema.parse({
      currentPassword: 'OldPass123',
      newPassword: 'NewPass123',
      confirmPassword: 'NewPass123',
    })
    expect(result.newPassword).toBe('NewPass123')
  })

  it('should reject mismatched passwords', () => {
    expect(() => changePasswordSchema.parse({
      currentPassword: 'OldPass123',
      newPassword: 'NewPass123',
      confirmPassword: 'Different123',
    })).toThrow()
  })
})

