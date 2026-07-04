  import { Encrypt, encryptWithIV } from './Cryptography';
  import { randomBytes, randomInt  } from 'crypto';
  export const createResponse = (code: number, message: string, data?: any, reference?: string): any => {
    const response: any = {
      code,
      message
    };
    
    if (reference) {
      response.reference = reference;
    }
    
    if (data && typeof data === 'object') {
      for (const [key, value] of Object.entries(data)) {
        response[key] = value;
      }
    }

    const { iv, ciphertext } = encryptWithIV(JSON.stringify(response));

    const encryptedResponse = {
        iv,
        content: ciphertext
    };
    

    return response // JSON.stringify(encryptedResponse);
  };
