import crypto from 'crypto'
import jwt from "jsonwebtoken";
import { promises as fs } from "fs";
import { v4 as uuidv4 } from "uuid";

const Salt = process.env.Salt || "";

export const WriteJson = async (path: string, json: any): Promise<void> => {
  await fs.writeFile(`${path}.json`, JSON.stringify(json, null, 2));
};


export const GenerateId = (): string => {
  return crypto.randomBytes(16).toString("hex");
};


export const Encrypt = (text: string): string => {
  const key = crypto.createHash("sha256").update(Salt).digest().slice(0, 16);

  const iv = Buffer.alloc(16, 0);

  const cipher = crypto.createCipheriv("aes-128-cbc", key, iv);

  let encrypted = cipher.update(text, "utf8", "base64");
  encrypted += cipher.final("base64");

  return encrypted.trim();
};

export const encryptWithIV = (text: string) => {
  const key = crypto.createHash("sha256").update(Salt).digest().subarray(0, 16);
  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv("aes-128-cbc", key, iv);

  let encrypted = cipher.update(text, "utf8", "base64");
  encrypted += cipher.final("base64");

  return {
    iv: iv.toString("base64"),
    ciphertext: encrypted
  };
};



export const Decrypt = (encryptedString: string): string => {
  const key = crypto.createHash("sha256").update(Salt).digest().slice(0, 16);

  const iv = Buffer.alloc(16, 0);

  const decipher = crypto.createDecipheriv("aes-128-cbc", key, iv);

  let decrypted = decipher.update(encryptedString, "base64", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted.trim();
};

export const decryptWithIV = (ciphertext: string, ivBase64: string) => {
  const key = crypto.createHash("sha256").update(Salt).digest().subarray(0, 16);
  const iv = Buffer.from(ivBase64, "base64");

  const decipher = crypto.createDecipheriv("aes-128-cbc", key, iv);

  let decrypted = decipher.update(ciphertext, "base64", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
};

export const Hash = (type: string, input: string): string => {
  return crypto.createHash(type).update(Salt + input).digest("hex");
};
  

export const CreateJWT = (payload: object, secret: string): string => {
  const options = { algorithm: "HS256" as const };

  return jwt.sign(payload, secret, options);
};


export const createJWTV2 = (payload: object, signature: string): string => {
  const header = { alg: "HS256", typ: "JWT" };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");

  if (!signature.includes(":")) {
    throw new Error("Invalid signature format");
  }

  const signatureKey = signature.split(":")[1];
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const signatureHash = crypto
    .createHmac("sha1", signatureKey)
    .update(signingInput)
    .digest("base64url");

  return `${encodedHeader}.${encodedPayload}.${signatureHash}`;
};


export const DecodeJWT = (encoded: string): any => {
  const decoded = jwt.decode(encoded, { complete: true }) as { payload?: any } | null;

  if (!decoded || !decoded.payload) {
    throw new Error("Invalid JWT token");
  }

  return decoded.payload;
};


export const CreateParms = (): string => {
  return uuidv4();
};


export const CreateParmsV2 = (): string => {
  const genText = () => {
    const randomText = Array.from({ length: 34 }, () => Math.random().toString(34)[2]).join("");
    return Buffer.from(randomText).toString("base64");
  };

  return genText();
};


export const CreateGameId = (): string => {
  return uuidv4();
};


export const SessionToken = (): string => {
  const buffer = crypto.randomBytes(32);

  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
};


export const GenCaracters = (amount: number): string => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  let result = "";

  for (let i = 0; i < amount; i++) {
    const idx = crypto.randomInt(chars.length);
    result += chars[idx];
  }

  return result;
};


export const GenIntCaracters = (amount: number): string => {
  const digits = "123456789";
  let result = "";

  for (let i = 0; i < amount; i++) {
    const idx = crypto.randomInt(digits.length);
    result += digits[idx];
  }

  return result;
};



export const GenAndroidId = (): string => {
  return uuidv4().replace(/-/g, "");
};


export const GenWebGlId = (): string => {
  return "webgl_" + GenAndroidId();
};


export const GenIosId = (): string => {
  return uuidv4().toUpperCase();
};


export const gerarAverageMmr = (): string => {
  const min = 0xd00000;
  const max = 0xdfffff;

  const mmr = Math.floor(Math.random() * (max - min + 1)) + min;

  return mmr.toString(16).toUpperCase();
};


export const formatNumber = (number: number): string => {
  if (typeof number !== "number") {
    return "undefined";
  }

  return number.toLocaleString("en-US");
};

