import {writeFile,rename} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';

export async function atomicJson(file,value){
  const temporary=`${file}.${randomUUID()}.tmp`;
  await writeFile(temporary,JSON.stringify(value,null,2));
  await rename(temporary,file);
}
