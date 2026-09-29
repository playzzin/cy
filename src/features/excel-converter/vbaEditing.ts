import { CFB } from 'xlsx';
import type { CFB$Container } from 'cfb';
import cptable from 'codepage';
import JSZip from 'jszip';
import { MacroEdit } from './editingTypes';
import { compressVba, decompressVba } from './vbaCompression';

const bytes=(v:ArrayLike<number>)=>Uint8Array.from(v);
const u16=(b:Uint8Array,p:number)=>b[p]|(b[p+1]<<8);
const u32=(b:Uint8Array,p:number)=>(b[p]|(b[p+1]<<8)|(b[p+2]<<16)|(b[p+3]<<24))>>>0;
const stream=(cfb:CFB$Container,path:string):Uint8Array=>{const found=CFB.find(cfb,cfb.FullPaths[0]+path);if(!found)throw new Error('VBA 프로젝트의 필수 파일이 없습니다.');return bytes(found.content);};
const decode=(cp:number,b:Uint8Array)=>cptable.utils.decode(cp,b);
const encode=(cp:number,s:string)=>{const b=bytes(cptable.utils.encode(cp,s) as number[]);if(decode(cp,b)!==s)throw new Error('이 매크로의 문자 인코딩으로 저장할 수 없는 글자가 있습니다. 문자열은 ChrW를 사용해 작성해 주세요.');return b;};
function protectionState(project:string):number {
  const hex=/^CMG="([0-9a-f]+)"/im.exec(project)?.[1];if(!hex)throw new Error('VBA 보호 상태를 확인하지 못했습니다.');
  const b=bytes(hex.match(/../g)!.map(v=>parseInt(v,16)));if((b[0]^b[1])!==2)throw new Error('VBA 보호 정보 형식을 확인하지 못했습니다.');
  let plain=b[0]^b[2],e1=b[2],e2=b[1];const out:number[]=[];
  for(let p=3;p<b.length;p++){plain=b[p]^((e2+plain)&255);e2=e1;e1=b[p];out.push(plain);}
  const skip=(b[0]&6)/2,data=bytes(out);if(u32(data,skip)!==4||data.length!==skip+8)throw new Error('VBA 보호 정보가 올바르지 않습니다.');return u32(data,skip+4);
}
export interface VbaModule {name:string;stream:string;code:string;kind:'standard'|'document';offsetPosition:number}
export interface VbaProject {cfb:CFB$Container;dir:Uint8Array;codepage:number;modules:VbaModule[];moduleCountPosition:number;moduleEnd:number;project:string}
export function readVbaProject(data:Uint8Array):VbaProject {
  if(data.length>8*1024*1024)throw new Error('매크로 프로젝트가 편집 한도를 초과했습니다.');
  const cfb=CFB.read(data,{type:'array'}) as CFB$Container,dir=decompressVba(stream(cfb,'VBA/dir'));let cp=0;
  for(let p=0;p+6<=dir.length;){const id=u16(dir,p),size=u32(dir,p+2);if(id===3&&size===2){cp=u16(dir,p+6);break;}p+=6+size;}
  if(!cp||!cptable.utils.hascp(cp))throw new Error('매크로의 문자 인코딩을 지원하지 않습니다.');
  const project=decode(cp,stream(cfb,'PROJECT'));if(protectionState(project)&7)throw new Error('잠긴 VBA 프로젝트입니다. Excel에서 잠금을 해제한 사본을 올려 주세요.');
  const candidates:Pick<VbaProject,'modules'|'moduleCountPosition'|'moduleEnd'>[]=[];
  for(let start=0;start+16<dir.length;start++){
    if(u16(dir,start)!==15||u32(dir,start+2)!==2||u16(dir,start+8)!==19||u32(dir,start+10)!==2)continue;
    const count=u16(dir,start+6);if(count>200)continue;let p=start+16,totalSource=0;const modules:VbaModule[]=[];
    try {for(let i=0;i<count;i++){
      const mod:VbaModule={name:'',stream:'',code:'',kind:'document',offsetPosition:0};let ended=false;
      for(let n=0;n<20&&p+6<=dir.length;n++){const id=u16(dir,p),size=u32(dir,p+2),at=p+6;if(size>dir.length-at)throw new Error();
        if(![0x19,0x47,0x1A,0x32,0x1C,0x48,0x31,0x1E,0x2C,0x21,0x22,0x25,0x28,0x2B].includes(id))throw new Error();
        if(id===0x19)mod.name=decode(cp,dir.subarray(at,at+size));
        if(id===0x47)mod.name=decode(1200,dir.subarray(at,at+size));
        if(id===0x1A)mod.stream=decode(cp,dir.subarray(at,at+size));
        if(id===0x32)mod.stream=decode(1200,dir.subarray(at,at+size));
        if(id===0x31&&size===4)mod.offsetPosition=at;
        if(id===0x21)mod.kind='standard';p=at+size;
        if(id===0x2B){ended=true;break;}
      }
      if(!ended||!mod.name||!mod.stream||!mod.offsetPosition)throw new Error();
      const content=stream(cfb,`VBA/${mod.stream}`),offset=u32(dir,mod.offsetPosition);if(offset>=content.length)throw new Error();
      mod.code=decode(cp,decompressVba(content.subarray(offset)));totalSource+=mod.code.length;if(totalSource>3*1024*1024)throw new Error();modules.push(mod);
    }
    if(u16(dir,p)!==0x10||u32(dir,p+2)!==0)throw new Error();
    candidates.push({modules,moduleCountPosition:start+6,moduleEnd:p});
    }catch{/* A reference can contain the same bytes; accept only a complete module section. */}
  }
  if(candidates.length!==1)throw new Error('매크로 모듈 구조를 확인할 수 없습니다. 원본은 변경되지 않았습니다.');
  return {cfb,dir,codepage:cp,project,...candidates[0]};
}
const normalize=(s:string)=>s.replace(/\r\n|\r|\n/g,'\r\n');
const attributes=(s:string)=>normalize(s).split('\r\n').map(line=>line.trimStart()).filter(line=>/^Attribute\s/i.test(line));
export function mergeVbaModuleSource(module:Pick<VbaModule,'code'>,requested:string):string {
  const lines=normalize(requested).split('\r\n').filter(line=>!/^\s*Attribute\s/i.test(line));
  if(/\x00/.test(requested))throw new Error('매크로 코드에 잘못된 문자가 있습니다.'); // eslint-disable-line no-control-regex
  // Preserve hidden module identity and class attributes independently of AI output.
  const metadata=attributes(module.code);
  for(const attribute of metadata.filter(a=>!/^Attribute VB_/i.test(a))){const name=/^Attribute\s+([^\s.]+)\./i.exec(attribute)?.[1];if(!name)throw new Error('모듈의 속성 이름을 확인할 수 없습니다.');
    const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const declaration=new RegExp(`^[ \\t]*(?:(?:Public|Private|Friend|Static)\\s+)*(?:Sub|Function|Property\\s+(?:Get|Let|Set))\\s+${escaped}(?=[\\s(]|$)`,'i');
    let at=lines.findIndex(line=>declaration.test(line));
    if(at>=0){while(/\s_\s*$/.test(lines[at])&&at+1<lines.length)at++;while(/^\s*Attribute\s/i.test(lines[at+1]||''))at++;lines.splice(at+1,0,attribute);}
  }
  return metadata.filter(a=>/^Attribute VB_/i.test(a)).join('\r\n')+'\r\n'+lines.join('\r\n').replace(/\s+$/,'')+'\r\n';
}
export function rewriteVbaProject(data:Uint8Array,edits:MacroEdit[]):Uint8Array {
  const project=readVbaProject(data);const names=new Set<string>();
  for(const edit of edits){const key=edit.module.toLowerCase();if(names.has(key))throw new Error('같은 매크로 모듈이 중복 지정됐습니다.');names.add(key);
    const module=project.modules.find(m=>m.name.toLowerCase()===key);if(!module)throw new Error(`매크로 모듈 ${edit.module}을 찾지 못했습니다. 기존 모듈 이름으로 요청해 주세요.`);
    module.code=mergeVbaModuleSource(module,edit.code);
  }
  // Strip stale compiled caches from every module, not only edited modules.
  for(const module of project.modules){project.dir.fill(0,module.offsetPosition,module.offsetPosition+4);CFB.utils.cfb_add(project.cfb,project.cfb.FullPaths[0]+`VBA/${module.stream}`,compressVba(encode(project.codepage,module.code)));}
  CFB.utils.cfb_add(project.cfb,project.cfb.FullPaths[0]+'VBA/dir',compressVba(project.dir));
  CFB.utils.cfb_add(project.cfb,project.cfb.FullPaths[0]+'VBA/_VBA_PROJECT',bytes([0xCC,0x61,0xFF,0xFF,0,0,0]));
  for(const path of [...project.cfb.FullPaths])if(/\/__SRP_[^/]+$/i.test(path))CFB.utils.cfb_del(project.cfb,path);
  CFB.utils.cfb_gc(project.cfb);
  const output=bytes(CFB.write(project.cfb,{type:'array',fileType:'cfb'}));
  const reopened=readVbaProject(output);
  if(reopened.modules.some((m,i)=>m.code!==project.modules[i].code))throw new Error('저장한 매크로 코드를 다시 확인하지 못했습니다.');
  return output;
}
export async function applyMacroEdits(zip:JSZip,edits:MacroEdit[]):Promise<void> {
  if(!edits.length)return;
  if(Object.keys(zip.files).some(p=>/vbaProjectSignature|_xmlsignatures/i.test(p)))throw new Error('서명된 매크로입니다. 서명을 제거한 사본에서 편집한 뒤 Excel에서 다시 서명해 주세요.');
  const entry=zip.file('xl/vbaProject.bin');if(!entry)throw new Error('기존 매크로가 들어 있는 .xlsm 양식을 올려 주세요.');
  zip.file('xl/vbaProject.bin',rewriteVbaProject(await entry.async('uint8array'),edits));
}
export async function macroContext(bytes:ArrayBuffer,edits:MacroEdit[]) {
  const zip=await JSZip.loadAsync(bytes);await applyMacroEdits(zip,edits);const entry=zip.file('xl/vbaProject.bin');
  if(!entry)throw new Error('매크로를 수정하려면 기존 매크로가 있는 .xlsm 양식을 올려 주세요.');
  const project=readVbaProject(await entry.async('uint8array'));
  return {codepage:project.codepage,modules:project.modules.map(m=>({name:m.name,kind:m.kind,code:m.code}))};
}
