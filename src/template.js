import fs from 'fs';
import path from 'path';

const cache = {};

export default function template(file, data) {
  let template = cache[file];
  if (!template) {
    template = fs.readFileSync(path.join('./templates', file), 'utf-8');
    cache[file] = template;
  }

  return template.replace(/%([a-zA_Z0-9_-]+)%/g, (match, key) => {
    let value = data[key.trim()];
    if (value === undefined) {
      throw new Error(`Template variable ${key} not found`);
    }
    return value;
  });
}