#!/usr/bin/env python3
import argparse,hashlib,json,logging,os,re,shutil,subprocess,sys,tempfile,urllib.error,urllib.parse,urllib.request
from dataclasses import dataclass
from pathlib import Path
from openpyxl import Workbook,load_workbook
from openpyxl.styles import Font
from openpyxl.utils import get_column_letter
ROOT=Path(__file__).resolve().parent;CENSUS=ROOT/"project_census.xlsx";FRONTEND_MAP=ROOT/"frontend_mapping.json";FRONTEND_APP=ROOT/"frontend"/"public"/"frontend_mapping.json";INDEX_HTML=ROOT/"index.html";GEMINI_KEY_FILE=ROOT/"gemini_api_key.txt";SUTTA_DATA_JS=ROOT/"suttaData.js";SUTTA_DATA_APP_JS=ROOT/"frontend"/"src"/"lib"/"suttaData.js"
FFMPEG,YTDLP,GEMINI_MODEL,GEMINI_KEY=os.getenv("FFMPEG","ffmpeg"),os.getenv("YTDLP","yt-dlp"),os.getenv("GEMINI_MODEL","gemini-2.0-flash"),os.getenv("GEMINI_API_KEY") or (GEMINI_KEY_FILE.read_text().strip() if GEMINI_KEY_FILE.exists() else None)
RE_SUTTA=re.compile(r"(?<!\d)(\d{1,3})[._-](\d{1,3})[._-](\d{1,3})(?!\d)");RE_SUTTA_2=re.compile(r"(?<!\d)(\d{1,3})[._-](\d{1,3})(?!\d)");RE_TIME=re.compile(r"(\d{2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]\d{3})");RE_TAG=re.compile(r"<[^>]+>");RE_NOISE=re.compile(r"\s*[\(\[]?(?:Music|Laughter|Applause|Noise|Silence)[\)\]]?\s*",re.I)
log=logging.getLogger("golden-sync");MAPPING,INVENTORY,ENRICHMENT="Mapping","Inventory","Enrichment"
NUMS = {"zero":"0","one":"1","two":"2","three":"3","four":"4","five":"5","six":"6","seven":"7","eight":"8","nine":"9","ten":"10","eleven":"11","twelve":"12","thirteen":"13","fourteen":"14","fifteen":"15","sixteen":"16","seventeen":"17","eighteen":"18","nineteen":"19","twenty":"20","thirty":"30","forty":"40","fifty":"50","sixty":"60","seventy":"70","eighty":"80","ninety":"90"}
def normalize_id(s:str)->str:
    s=str(s).strip()
    if m:=RE_SUTTA.search(s):return "_".join(m.groups())
    if m:=RE_SUTTA_2.search(s):return f"{m.group(1)}_{m.group(2)}"
    if m:=re.search(r"(\d+)",re.sub(r"^[A-Z]+\s*","",s,flags=re.I)):return m.group(1)
    raise ValueError(f"Invalid ID: {s!r}")
def safe_name(s:str)->str: return re.sub(r'[<>:"/\|?*]',"_",str(s).strip()).rstrip(". ") or "Unknown"
@dataclass(frozen=True)
class Row:
    sutta_id:str;video_id:str;nikaya:str
    @property
    def sid(self)->str: return normalize_id(self.sutta_id)
    @property
    def did(self)->str:
        if re.match(r"^(AN|SN|DN|KN|MN)",str(self.sutta_id).strip(),re.I):return str(self.sutta_id).strip()
        p={"anguttara":"AN ","samyutta":"SN ","digha":"DN ","khuddaka":"KN ","majjhima":"MN "}.get(next((k for k in ["anguttara","samyutta","digha","khuddaka","majjhima"] if k in self.nikaya.lower()),""),"")
        return f"{p}{self.sid.replace('_','.')}"
    @property
    def nid(self)->str:
        nl = self.nikaya.lower()
        if "anguttara" in nl: return "an"
        if "samyutta" in nl: return "sn"
        if "digha" in nl: return "dn"
        if "khuddaka" in nl: return "kn"
        if "majjhima" in nl: return "mn"
        return nl.split()[0]
    @property
    def paths(self)->tuple[Path,Path,Path,Path]:f=ROOT/safe_name(self.nikaya)/self.sid;return f,f/f"{self.sid}.json",f/f"{self.sid}.mp4",f/f"{self.sid}.en.srt"
def atomic_write(path:Path,content:str|dict):
    path.parent.mkdir(parents=True,exist_ok=True);fd,tmp=tempfile.mkstemp(prefix=f".{path.name}.",suffix=".tmp",dir=path.parent)
    try:
        with os.fdopen(fd,"w",encoding="utf-8") as f:f.write(json.dumps(content,ensure_ascii=False,indent=2,sort_keys=True)+"\n" if isinstance(content,dict) else content);f.flush();os.fsync(f.fileno())
        os.replace(Path(tmp),path)
    finally:Path(tmp).unlink(missing_ok=True)
def sha256(p:Path)->str:
    if not p.exists():return ""
    h=hashlib.sha256()
    with p.open("rb") as f:
        while chunk:=f.read(1048576):h.update(chunk)
    return h.hexdigest()
def run(cmd:list[str]):
    log.debug("$ %s"," ".join(map(str,cmd)));r=subprocess.run(cmd,text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    if r.returncode!=0:raise RuntimeError(f"Command failed ({r.returncode}):\n{' '.join(cmd)}\n\n{r.stderr[-5000:]}")
    return r
def style(ws):
    ws.freeze_panes="A2"
    for c in ws[1]:c.font=Font(bold=True)
    for c in range(1,ws.max_column+1):ws.column_dimensions[get_column_letter(c)].width=min(80,max([12]+[len(str(ws.cell(r,c).value or ""))+2 for r in range(1,min(ws.max_row,1000)+1)]))
def ensure_census():
    if CENSUS.exists():return
    wb=Workbook()
    for n,h in [(MAPPING,["Sutta ID","Video ID","Nikaya Folder"]),(INVENTORY,["Sutta ID","Nikaya Folder","JSON","MP4","SRT","Status","JSON SHA256","MP4 SHA256","SRT SHA256"]),(ENRICHMENT,["Sutta ID","Official Name","Pali Name","Teacher Name","Simile Name","Buddha Words","Bhante Commentary","MCQ","Doctrinal Chains"])]:
        ws=wb.create_sheet(n) if n!=MAPPING else wb.active;ws.title=n;ws.append(h);style(ws)
    wb.save(CENSUS);log.info("Created %s",CENSUS)
def read_mapping()->list[Row]:
    ensure_census();wb=load_workbook(CENSUS,read_only=True,data_only=True);ws=wb[MAPPING];rows=list(ws.iter_rows(values_only=True));wb.close();out={}
    if len(rows)>1:
        h={str(v).strip():i for i,v in enumerate(rows[0]) if v}
        for r in rows[1:]:
            if r and any(r):
                try:
                    sid,vid,nik=str(r[h["Sutta ID"]]).strip(),str(r[h["Video ID"]]).strip(),str(r[h["Nikaya Folder"]]).strip()
                    if sid and vid and nik:row=Row(sid,vid,nik);out[row.sid]=row
                except Exception as e:log.warning("Skipping row %s: %s",r,e)

    # SCAN FILESYSTEM FOR ADDITIONAL SUTTAS NOT IN EXCEL
    for nik_dir in [d for d in ROOT.iterdir() if d.is_dir() and "Nikaya" in d.name]:
        for sutta_dir in [d for d in nik_dir.iterdir() if d.is_dir()]:
            sid = sutta_dir.name
            if sid not in out:
                log.info("Found unregistered sutta folder: %s/%s", nik_dir.name, sid)
                # Try to guess a Sutta ID for display
                did = f"{nik_dir.name.split()[0].upper()} {sid.replace('_','.')}"
                out[sid] = Row(sid, "", nik_dir.name)

    return sorted(out.values(),key=lambda x:(x.nikaya.lower(),x.sid))
def rebuild_inventory(mapping:list[Row]):
    wb=load_workbook(CENSUS);ws=wb[INVENTORY] if INVENTORY in wb.sheetnames else wb.create_sheet(INVENTORY);ws.delete_rows(1,ws.max_row);ws.append(["Sutta ID","Nikaya Folder","JSON","MP4","SRT","Status","JSON SHA256","MP4 SHA256","SRT SHA256"])
    inventory_data = [["Sutta ID","Nikaya Folder","JSON","MP4","SRT","Status","JSON SHA256","MP4 SHA256","SRT SHA256"]]
    for row in mapping:
        f,j,m,s=row.paths;exists=[p.exists() and p.stat().st_size>0 for p in (j,m,s)]
        row_data = [row.sid,row.nikaya,f'=HYPERLINK("{j.resolve().as_uri()}","{j.name}")' if exists[0] else "",f'=HYPERLINK("{m.resolve().as_uri()}","{m.name}")' if exists[1] else "",f'=HYPERLINK("{s.resolve().as_uri()}","{s.name}")' if exists[2] else "","COMPLETE" if all(exists) else "MISSING_TRINITY",sha256(j),sha256(m),sha256(s)]
        ws.append(row_data); inventory_data.append(row_data)
    style(ws);wb.save(CENSUS);wb.close()
    import csv;
    with open(ROOT/"projectstatus.csv", "w", encoding="utf-8", newline="") as f:
        csv.writer(f).writerows([[str(c) for c in r] for r in inventory_data])
    log.info("Exported projectstatus.csv")
def acquire(row:Row)->tuple[Path,Path,str]:
    temp=Path(tempfile.mkdtemp(prefix="buddha3_sync_"));url=f"https://www.youtube.com/watch?v={urllib.parse.quote(row.video_id,safe='')}"
    try:
        title = run([YTDLP,"--get-title",url]).stdout.strip()
        run([YTDLP,"--no-playlist","--no-progress","-f","bv*+ba/b","--merge-output-format","mp4","-o",str(temp/"source.%(ext)s"),url])
        if not (video:=next((p for p in sorted(temp.glob("source.*")) if p.suffix.lower() in {".mp4",".mkv",".webm",".mov"}),None)):raise RuntimeError(f"No video for {row.sid}")
        for lang in ["en,en.*","en"]:
            try:run([YTDLP,"--no-playlist","--skip-download","--write-auto-subs","--sub-langs",lang,"--sub-format","srt","-o",str(temp/"subs"),url])
            except:continue
            if sub:=next((p for p in sorted(temp.glob("*.srt"))),None):return video,sub,title
        raise RuntimeError(f"No subtitle for {row.sid}")
    except:shutil.rmtree(temp,ignore_errors=True);raise
def numerise(text:str)->str:
    # Handle "five point four point forty" -> "5.4.40"
    text = re.sub(r"\b(one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:point|poin|dot)\s*(\d+)\s*(?:point|poin|dot)\s*(\d+)\b",
                  lambda m: f"{NUMS[m.group(1).lower()]}.{m.group(2)}.{m.group(3)}", text, flags=re.I)
    pattern = re.compile(r'\b(' + '|'.join(NUMS.keys()) + r')\b', re.IGNORECASE)
    text = pattern.sub(lambda m: NUMS[m.group(0).lower()], text)
    return re.sub(r"\b(?:point|poin|dot)\b", ".", text, flags=re.I)
def parse_srt(path:Path)->list[tuple[float,float,str]]:
    raw=path.read_text(encoding="utf-8",errors="replace").replace("\r\n","\n");to_sec=lambda ts:sum(float(x)*60**i for i,x in enumerate(reversed(ts.replace(",",".").split(":"))));cues=[]
    for block in re.split(r"\n\s*\n",raw):
        if m:=RE_TIME.search(block):
            if text:=re.sub(r"\s+"," ",RE_NOISE.sub(" ",RE_TAG.sub("",block[m.end():].strip()))).strip():cues.append((to_sec(m.group(1)),to_sec(m.group(2)),text))
    return cues
def find_segment(cues:list,target:str,title:str)->tuple[float,float,str]:
    # Extract book number from title if possible (e.g. "Book 5")
    book_match = re.search(r"Book\s*(\d+)", title, re.I)
    book_hint = book_match.group(1) if book_match else None

    # Standard numbers for search: [5, 4, 40]
    nums = target.split('_')
    numerised_texts = [numerise(t) for (_,_,t) in cues]

    # Strategy 1: Search for full sequence or Nikaya-prefixed versions
    # This handles "AN 5.4.40", "5.4.40", "5.40", "5.40 AN" etc.
    prefix = next((k for k in ["AN","SN","DN","KN"] if k in target.upper()), "")
    patterns = [
        rf"(?<!\d){r'[\s._-]*'.join(nums)}(?!\d)", # 5.4.40
        rf"{prefix}\s*{r'[\s._-]*'.join(nums)}",   # AN 5.4.40
        rf"{r'[\s._-]*'.join(nums)}\s*{prefix}",   # 5.4.40 AN
    ]
    if len(nums) == 3: # Handle shorthand 5.40 for 5.4.40
        shorthand = [nums[0], nums[2]]
        patterns.append(rf"(?<!\d){r'[\s._-]*'.join(shorthand)}(?!\d)")
        patterns.append(rf"{prefix}\s*{r'[\s._-]*'.join(shorthand)}")

    hit = None
    for p in patterns:
        hit = next((i for i,t in enumerate(numerised_texts) if re.search(p, t, re.I)), None)
        if hit is not None: break

    if hit is None and book_hint:
        # Strategy 2: If we have book hint, search for y.z (e.g. 4.40)
        suffix_nums = nums[1:] if nums[0] == book_hint else nums
        pattern = re.compile(rf"(?<!\d){r'\s*[\s._-]\s*'.join(suffix_nums)}(?!\d)")
        hit = next((i for i,t in enumerate(numerised_texts) if pattern.search(t)), None)

    if hit is None:
        # Strategy 3: Loose search for numbers in text
        loose = ".*".join(nums)
        hit = next((i for i,t in enumerate(numerised_texts) if re.search(loose, t)), None)

    if hit is None:
        raise RuntimeError(f"Cannot locate {target} in transcript")

    start, end = cues[hit][0], cues[hit][1]
    for i in range(hit+1,len(cues)):
        # End segment when ANY next sutta pattern appears (2-part or 3-part)
        if RE_SUTTA.search(numerised_texts[i]) or RE_SUTTA_2.search(numerised_texts[i]):
            # But don't stop if it's just the teacher repeating the current ID
            if not any(num in numerised_texts[i] for num in nums[-2:]):
                end = cues[i][0]
                break
        end = cues[i][1]
    return start,end," ".join(c[2] for c in cues if c[1]>start and c[0]<end).strip()
class Librarian:
    def __init__(self):self.key,self.model=GEMINI_KEY,GEMINI_MODEL
    def enrich(self,sid:str,transcript:str)->dict:
        if len(transcript)>32000:transcript=transcript[:16000]+"\n\n[OMITTED]\n\n"+transcript[-16000:]
        schema={"names":{"official":None,"pali":None,"teacher":None,"simile":None},"content":{"buddha_words":"","bhante_commentary":""},"mcq":[],"doctrinal_chains":[]}
        payload={"contents":[{"parts":[{"text":f"Librarian Agent. Sutta ID: {sid}. Return JSON only. Transcript: {transcript}"}]}],"generationConfig":{"temperature":0,"responseMimeType":"application/json"}}
        req=urllib.request.Request(f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.key}",data=json.dumps(payload).encode(),headers={"Content-Type":"application/json"})
        with urllib.request.urlopen(req,timeout=180) as r:text=json.loads(r.read().decode())["candidates"][0]["content"]["parts"][0]["text"]
        start,end=text.find("{"),text.rfind("}");data=json.loads(text[start:end+1]);return {"names":{k:data.get("names",{}).get(k) for k in ("official","pali","teacher","simile")},"content":{k:data.get("content",{}).get(k,"") for k in ("buddha_words","bhante_commentary")},"mcq":data.get("mcq",[]),"doctrinal_chains":data.get("doctrinal_chains",[])}
def split_transcript(text:str)->tuple[str,str]:
    t = text.lower()
    start_idx = t.find("thus have i heard")
    if start_idx == -1: start_idx = 0

    # Refined commentary patterns based on actual transcripts
    patterns = [
        "stop here for a while", "i'll just stop here", "so here the buddha",
        "so in this sutta", "i will just stop here", "stop it for a moment",
        "i think maybe a better translation", "i've explained it fully"
    ]
    comm_idx = -1
    for p in patterns:
        idx = t.find(p)
        if idx != -1:
            if comm_idx == -1 or idx < comm_idx:
                comm_idx = idx

    if comm_idx != -1 and comm_idx > start_idx:
        return text[start_idx:comm_idx].strip(), text[comm_idx:].strip()
    return text.strip(), ""

def repair(row:Row,librarian:Librarian|None,force:bool=False):
    f,j,m,s=row.paths;f.mkdir(parents=True,exist_ok=True);existing=json.loads(j.read_text(encoding="utf-8")) if j.exists() else {};video,src_srt,title=acquire(row)
    try:
        cues=parse_srt(src_srt);start,end,text=find_segment(cues,row.sid,title)
        if not s.exists():atomic_write(s,"\n".join(f"{i}\n{f1} --> {f2}\n{t}\n" for i,(a,b,t) in enumerate([c for c in cues if c[1]>start and c[0]<end],1) for f1,f2 in [(f"{int(round(max(0.0,a-start)*1000))//3600000:02d}:{(int(round(max(0.0,a-start)*1000))//60000)%60:02d}:{(int(round(max(0.0,a-start)*1000))//1000)%60:02d},{int(round(max(0.0,a-start)*1000))%1000:03d}",f"{int(round(max(0.0,b-start)*1000))//3600000:02d}:{(int(round(max(0.0,b-start)*1000))//60000)%60:02d}:{(int(round(max(0.0,b-start)*1000))//1000)%60:02d},{int(round(max(0.0,b-start)*1000))%1000:03d}")]))
        if not m.exists():run([FFMPEG,"-y","-ss",f"{start:.3f}","-i",str(video),"-t",f"{max(0,end-start):.3f}","-c:v","libx264","-preset","veryfast","-crf","23","-c:a","aac","-movflags","+faststart",str(m)])

        sutta_text, comm_text = split_transcript(text)
        enr=librarian.enrich(row.sid,text) if librarian and (force or not existing.get("names")) else {}

        # Detect available languages
        languages = ["en"]
        if (f / "jp").exists():
            languages.append("ja")
        if (f / "hi").exists():
            languages.append("hi")

        # Force the did (e.g. AN 5.4.40) into the JSON
        atomic_write(j,{**existing,"schema_version":"2.0","sutta_id":row.did,"video_id":row.video_id,"nikaya":row.nikaya,"transcript":text, "sutta": sutta_text, "commentary": comm_text, "valid": True, "aud_file": m.name if m.exists() else "", "languages": languages, **enr})

        # Also update languages in other lang folders if they exist
        for lcode, subf in [("ja", "jp"), ("hi", "hi")]:
            lpath = f / subf / j.name
            if lpath.exists():
                try:
                    ldata = json.loads(lpath.read_text(encoding="utf-8"))
                    if ldata.get("languages") != languages:
                        ldata["languages"] = languages
                        atomic_write(lpath, ldata)
                except: pass
    except Exception:
        log.error("[%s] FAILED. Keeping source files for inspection.", row.sid)
        raise
    finally:
        # Only cleanup if we didn't crash
        if all(p.exists() for p in (j, m, s)):
            shutil.rmtree(video.parent,ignore_errors=True)
def main()->int:
    ap=argparse.ArgumentParser();ap.add_argument("--enrich",action="store_true");ap.add_argument("--inventory",action="store_true");args=ap.parse_args();logging.basicConfig(level=logging.INFO,format="%(asctime)s | %(message)s")
    ensure_census();mapping=read_mapping();log.info("Loaded %d suttas",len(mapping))
    if args.inventory:rebuild_inventory(mapping);return 0
    shutil.copy2(SUTTA_DATA_JS,SUTTA_DATA_APP_JS) if SUTTA_DATA_JS.exists() and SUTTA_DATA_APP_JS.parent.exists() else None
    lib=Librarian() if GEMINI_KEY else None
    for row in mapping:
        try:
            f, j, m, s = row.paths
            files_exist = all(p.exists() and p.stat().st_size > 0 for p in (j, m, s))

            if files_exist and not args.enrich:
                # Update RAW JSONs to COMPLETE using heuristics if needed
                metadata = json.loads(j.read_text(encoding="utf-8"))
                needs_update = False
                if not (metadata.get("sutta") and metadata.get("commentary")):
                    log.info("[%s] Upgrading RAW JSON to COMPLETE", row.sid)
                    sutta_text, comm_text = split_transcript(metadata.get("transcript", ""))
                    metadata.update({"sutta": sutta_text, "commentary": comm_text})
                    needs_update = True

                if not metadata.get("valid") or not metadata.get("aud_file"):
                    if not metadata.get("valid"):
                        metadata["valid"] = True
                    if not metadata.get("aud_file") and m.exists():
                        metadata["aud_file"] = m.name
                    needs_update = True

                # Detect available languages
                languages = ["en"]
                if (f / "jp").exists():
                    languages.append("ja")
                if (f / "hi").exists():
                    languages.append("hi")

                if metadata.get("languages") != languages:
                    metadata["languages"] = languages
                    needs_update = True

                if needs_update:
                    atomic_write(j, metadata)

                # Also update languages in other lang folders if they exist
                for lcode, subf in [("ja", "jp"), ("hi", "hi")]:
                    lpath = f / subf / j.name
                    if lpath.exists():
                        try:
                            ldata = json.loads(lpath.read_text(encoding="utf-8"))
                            if ldata.get("languages") != languages:
                                ldata["languages"] = languages
                                atomic_write(lpath, ldata)
                        except: pass
                continue

            repair(row,lib,args.enrich)
        except Exception:log.exception("[%s] FAILED",row.sid)
    rebuild_inventory(mapping)
    # Generate mapping including GHOST suttas (those in blueprint but missing assets)
    ents = {}
    for r in mapping:
        f, j, m, s = r.paths
        files_exist = all(p.exists() and p.stat().st_size > 0 for p in (j, m, s))
        metadata = json.loads(j.read_text(encoding="utf-8")) if j.exists() else {}

        # Contract Check: Does it have the split fields?
        has_contract = metadata.get("sutta") and metadata.get("commentary")

        status = "GHOST"
        if files_exist:
            status = "COMPLETE" if has_contract else "RAW"

        # Smarter data handling for images
        if metadata and f.exists():
            # If JSON has a filename but no path, prefix it with the folder path
            img = metadata.get("image_url")
            if img and "/" not in img and "\\" not in img:
                metadata["image_url"] = (f.relative_to(ROOT) / img).as_posix()

            # Auto-detect image if missing but exists in folder
            if not metadata.get("image_url"):
                for ext in [".png", ".webp", ".jpg"]:
                    img_file = next(f.glob(f"*{ext}"), None)
                    if img_file:
                        metadata["image_url"] = img_file.relative_to(ROOT).as_posix()
                        break

        # Detect available languages
        languages = ["en"]
        if (f / "jp").exists():
            languages.append("ja")
        if (f / "hi").exists():
            languages.append("hi")

        ents[r.did] = {
            "sutta_id": r.did,
            "video_id": r.video_id,
            "nikaya": r.nid,
            "path": f.relative_to(ROOT).as_posix() if f.exists() else "",
            "json": j.relative_to(ROOT).as_posix() if j.exists() else "",
            "mp4": m.relative_to(ROOT).as_posix() if m.exists() else "",
            "srt": s.relative_to(ROOT).as_posix() if s.exists() else "",
            "sutta_name": metadata.get("names", {}).get("official", "") if status == "COMPLETE" else f"({status}) Sutta",
            "folder": r.sid,
            "aud_file": m.name if m.exists() else "",
            "status": status,
            "languages": languages
        }

    atomic_write(FRONTEND_MAP, {"schema_version": "2.0", "entries": ents})

    if INDEX_HTML.exists():
        mini = {k: {"video_id": v["video_id"], "nikaya": v["nikaya"], "path": v["path"], "sutta_name": v["sutta_name"], "aud_file": v["aud_file"]} for k, v in ents.items()}
        atomic_write(INDEX_HTML, re.sub(r"const\s+SUTTA_MAPPINGS\s*=\s*\{.*?\};", f"const SUTTA_MAPPINGS = {json.dumps(mini, ensure_ascii=False)};", INDEX_HTML.read_text(encoding="utf-8"), flags=re.S))
    return 0
if __name__=="__main__":sys.exit(main())
