// 轻量入参校验工具

import { HttpError } from './response.js';

export function requireString(value, field, { min = 1, max = 200 } = {}) {
  if (typeof value !== 'string') throw new HttpError(422, `${field} 必须为字符串`);
  const trimmed = value.trim();
  if (trimmed.length < min) throw new HttpError(422, `${field} 不能为空`);
  if (trimmed.length > max) throw new HttpError(422, `${field} 长度不能超过 ${max}`);
  return trimmed;
}

export function optionalString(value, field, { max = 2000 } = {}) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw new HttpError(422, `${field} 必须为字符串`);
  if (value.length > max) throw new HttpError(422, `${field} 长度不能超过 ${max}`);
  return value;
}

export function requireHexColor(value, field = 'color') {
  if (typeof value !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(value.trim())) {
    throw new HttpError(422, `${field} 必须为 #RRGGBB 格式`);
  }
  return value.trim().toLowerCase();
}

export function optionalInt(value, field, { min = -1000000, max = 1000000 } = {}) {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  if (!Number.isInteger(n)) throw new HttpError(422, `${field} 必须为整数`);
  if (n < min || n > max) throw new HttpError(422, `${field} 超出范围`);
  return n;
}

export function requireEnum(value, field, allowed) {
  if (!allowed.includes(value)) {
    throw new HttpError(422, `${field} 必须为以下之一: ${allowed.join(', ')}`);
  }
  return value;
}

export function optionalBool(value, field) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'boolean') throw new HttpError(422, `${field} 必须为布尔值`);
  return value;
}

export function isUuid(value) {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function requireUuid(value, field) {
  if (!isUuid(value)) throw new HttpError(422, `${field} 必须为合法 UUID`);
  return value;
}

// 生成 slug（支持中文：保留中文与字母数字，其余转连字符）
export function slugify(input) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9\u4e00-\u9fa5-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'item';
}
