/** Keep workbook string literals local while letting AI reason about code structure. */
export class PrivateLiteralError extends Error {
  constructor() { super('AI 응답에서 원문 문자열의 참조가 바뀌었습니다. 기존 결과는 유지됩니다. 같은 요청을 다시 보내 주세요.'); this.name='PrivateLiteralError'; }
}
export function privateLiterals(){
  const originals=new Map<string,string>();
  const mask=(code:string,vba=false)=>{
    const lines=vba?code.split(/\r\n|\r|\n/): [code];
    let continuedComment=false;
    return lines.map(line=>{
      if(vba&&continuedComment){continuedComment=/\s_\s*$/.test(line);return '';}
      if(vba&&/^\s*Attribute\s/i.test(line))return '';
      return line.replace(vba?/"(?:[^"]|"")*"|'[^\r\n]*|(?:^|[\s:])Rem(?:\s[^\r\n]*|$)/gi:/"(?:[^"]|"")*"/g,part=>{
      if(!part.startsWith('"')){continuedComment=/\s_\s*$/.test(part);return part.startsWith(':')?':':'';}
      if(part==='""')return part;
      const token=`__LOCAL_LITERAL_${originals.size}__`;originals.set(token,part);return `"${token}"`;
    });}).join('\r\n');
  };
  // Restore whole string tokens once. Embedded, unquoted, unknown or damaged
  // tokens must never become workbook content; token-looking originals stay literal.
  const restore=(code:string)=>code.replace(/"(?:[^"]|"")*"|__LOCAL_LITERAL_/gi,part=>{
    if(!/__LOCAL_LITERAL_/i.test(part))return part;
    const token=/^"(__LOCAL_LITERAL_\d+__)"$/.exec(part)?.[1];
    const value=token===undefined?undefined:originals.get(token);
    if(value===undefined)throw new PrivateLiteralError();
    return value;
  });
  return {mask,restore};
}
