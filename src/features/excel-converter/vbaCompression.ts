// MS-OVBA 2.4.1: bounded source compression, never a VBA interpreter.
export function decompressVba(input:Uint8Array,max=2*1024*1024):Uint8Array {
  if(input[0]!==1)throw new Error('VBA 압축 형식을 확인할 수 없습니다.');
  const out:number[]=[];let p=1;
  while(p<input.length){
    if(p+2>input.length)throw new Error('VBA 압축 데이터가 잘렸습니다.');
    const header=input[p]|(input[p+1]<<8),end=p+(header&4095)+3,start=out.length;p+=2;
    if(((header>>12)&7)!==3||end>input.length)throw new Error('VBA 압축 헤더가 올바르지 않습니다.');
    if(!(header&0x8000)){if(end-p!==4096)throw new Error('VBA 원시 청크 크기가 올바르지 않습니다.');while(p<end)out.push(input[p++]);}
    else while(p<end){const flags=input[p++];for(let bit=0;bit<8&&p<end;bit++){
      if(!(flags&(1<<bit)))out.push(input[p++]);
      else {if(p+2>end)throw new Error('VBA 복사 토큰이 잘렸습니다.');const token=input[p]|(input[p+1]<<8);p+=2;const bits=Math.max(4,Math.ceil(Math.log2(out.length-start))),shift=16-bits,len=(token&((1<<shift)-1))+3,offset=(token>>shift)+1;
        if(offset>out.length-start||out.length-start+len>4096)throw new Error('VBA 복사 범위가 올바르지 않습니다.');for(let i=0;i<len;i++)out.push(out[out.length-offset]);}
      if(out.length-start>4096||out.length>max)throw new Error('VBA 코드가 읽기 한도를 초과했습니다.');
    }}
    if(out.length>max)throw new Error('VBA 코드가 읽기 한도를 초과했습니다.');
  }
  return Uint8Array.from(out);
}
export function compressVba(input:Uint8Array):Uint8Array {
  const out:number[]=[1];
  for(let base=0;base<input.length;base+=4096){
    const chunk=input.subarray(base,base+4096),packed:number[]=[],dict=new Map<number,number[]>();let p=0;
    const key=(i:number)=>(chunk[i]<<16)|(chunk[i+1]<<8)|chunk[i+2];
    const remember=(i:number)=>{if(i+2>=chunk.length)return;const k=key(i),list=dict.get(k)||[];list.push(i);if(list.length>128)list.shift();dict.set(k,list);};
    while(p<chunk.length){const flagAt=packed.length;packed.push(0);for(let bit=0;bit<8&&p<chunk.length;bit++){
      const bits=Math.max(4,Math.ceil(Math.log2(Math.max(p,1)))),shift=16-bits,maxLen=Math.min((1<<shift)+2,chunk.length-p);let best=0,offset=0;
      if(p+2<chunk.length)for(const prev of dict.get(key(p))||[]){if(p-prev>(1<<bits))continue;let n=0;while(n<maxLen&&chunk[prev+n]===chunk[p+n])n++;if(n>best){best=n;offset=p-prev;}}
      if(best>=3){packed[flagAt]|=1<<bit;const token=((offset-1)<<shift)|(best-3);packed.push(token&255,token>>8);for(let n=0;n<best;n++)remember(p++);}
      else {packed.push(chunk[p]);remember(p++);}
    }}
    if(packed.length>=4096&&chunk.length===4096){out.push(255,63,...chunk);}
    else {if(packed.length>4096)throw new Error('압축하기 어려운 VBA 코드입니다. 긴 문자열을 나누어 주세요.');const header=0xB000|(packed.length-1);out.push(header&255,header>>8,...packed);}
  }
  return Uint8Array.from(out);
}
