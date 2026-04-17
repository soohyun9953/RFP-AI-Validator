import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';

/**
 * 엑셀 파일을 읽어서 JSON 배열로 변환합니다.
 */
export async function parseExcelData(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet);
                resolve(jsonData);
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsArrayBuffer(file);
    });
}

/**
 * 템플릿의 slide1.xml을 분석하여 최대 인덱스(chunkSize)를 감지합니다.
 */
function detectTemplateChunkSize(zip) {
    const slide1Xml = zip.file('ppt/slides/slide1.xml')?.asText();
    if (!slide1Xml) return 1;
    
    let maxIdx = 1;
    const tagMatchRegex = /{([^{}]+?)_(\d+)}/g;
    let match;
    while ((match = tagMatchRegex.exec(slide1Xml)) !== null) {
        const idx = parseInt(match[2]);
        if (!isNaN(idx) && idx > maxIdx) maxIdx = idx;
    }
    return maxIdx;
}

/**
 * [V15] 정밀 문자열 패칭 방식 (Precision String Patching)
 * 브라우저 DOMParser의 네임스페이스 오염을 피하기 위해 원본 문자열을 직접 편집합니다.
 */
function duplicateSlides(zip, count, chunkSize) {
    if (count <= 1) {
        // 1번만 있더라도 1번 슬라이드 태그는 고쳐줘야 함
        let sld1 = zip.file('ppt/slides/slide1.xml').asText();
        sld1 = sld1.replace(/{([^{}]+?)(?:_(\d+))?}/g, (match, key, rowInSlide) => {
            const rowIdxInRange = rowInSlide ? parseInt(rowInSlide) : 1;
            return `{${key}_${rowIdxInRange}}`;
        });
        zip.file('ppt/slides/slide1.xml', sld1);
        return;
    }

    // 1. 원본 소스 획득
    const presXml = zip.file('ppt/presentation.xml').asText();
    const ctXml = zip.file('[Content_Types].xml').asText();
    const presRelsXml = zip.file('ppt/_rels/presentation.xml.rels').asText();
    const sld1Xml = zip.file('ppt/slides/slide1.xml').asText();
    const sld1RelsXml = zip.file('ppt/slides/_rels/slide1.xml.rels')?.asText();

    // 2. ID 분석 (문자열 기반)
    let maxRidNum = 0;
    const ridMatches = presRelsXml.matchAll(/Id="rId(\d+)"/g);
    for (const m of ridMatches) {
        const n = parseInt(m[1]);
        if (n > maxRidNum) maxRidNum = n;
    }

    let maxSldIdNum = 255;
    const sldIdMatches = presXml.matchAll(/id="(\d+)"/g);
    for (const m of sldIdMatches) {
        const n = parseInt(m[1]);
        if (n > maxSldIdNum && n < 1000000) maxSldIdNum = n;
    }

    // 3. 1번 슬라이드 태그 정규화
    const sld1Fixed = sld1Xml.replace(/{([^{}]+?)(?:_(\d+))?}/g, (match, key, rowInSlide) => {
        const rowIdxInRange = rowInSlide ? parseInt(rowInSlide) : 1;
        return `{${key}_${rowIdxInRange}}`;
    });
    zip.file('ppt/slides/slide1.xml', sld1Fixed);

    // 4. 새 슬라이드 데이터 조립
    let newSldIdEntries = "";
    let newContentTypeEntries = "";
    let newRelEntries = "";

    for (let i = 2; i <= count; i++) {
        const rId = `rId${maxRidNum + (i - 1)}`;
        const sldId = maxSldIdNum + (i - 1);
        const slideFileName = `slide${i}.xml`;
        const slidePath = `ppt/slides/${slideFileName}`;

        // Metadata entries
        newSldIdEntries += `<p:sldId id="${sldId}" r:id="${rId}"/>`;
        newContentTypeEntries += `<Override PartName="/${slidePath}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`;
        newRelEntries += `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/${slideFileName}"/>`;

        // Slide Content (변환)
        let slideNStr = sld1Xml.replace(/{([^{}]+?)(?:_(\d+))?}/g, (match, key, rowInSlide) => {
            const rowIdxInRange = rowInSlide ? parseInt(rowInSlide) : 1;
            const globalRowIdx = (i - 1) * chunkSize + rowIdxInRange;
            return `{${key}_${globalRowIdx}}`;
        });
        // Shape ID 충돌 방지
        slideNStr = slideNStr.replace(/ id="(\d+)"/g, (match, idStr) => ` id="${parseInt(idStr) + ((i-1) * 1000)}"`);
        
        zip.file(slidePath, slideNStr);
        if (sld1RelsXml) zip.file(`ppt/slides/_rels/${slideFileName}.rels`, sld1RelsXml);
    }

    // 5. 문자열 패치 적용 - 원본 구조의 네임스페이스를 해치지 않음
    
    // [Presentation.xml] - 기존 슬라이드 삭제(1번 제외) 후 새 슬라이드 삽입
    // 1번 슬라이드 정보(첫번째 p:sldId)만 남깁니다.
    const sldIdLstMatch = presXml.match(/<p:sldIdLst>([\s\S]*?)<\/p:sldIdLst>/);
    if (sldIdLstMatch) {
        const firstSldId = sldIdLstMatch[1].match(/<p:sldId[^>]+>/)?.[0] || "";
        const updatedSldIdLst = `<p:sldIdLst>${firstSldId}${newSldIdEntries}</p:sldIdLst>`;
        const newPresXml = presXml.replace(/<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>/, updatedSldIdLst);
        zip.file('ppt/presentation.xml', newPresXml);
    }

    // [[Content_Types].xml] - Override 추가
    const newCtXml = ctXml.replace('</Types>', `${newContentTypeEntries}</Types>`);
    zip.file('[Content_Types].xml', newCtXml);

    // [presentation.xml.rels] - Relationship 추가
    const newPresRelsXml = presRelsXml.replace('</Relationships>', `${newRelEntries}</Relationships>`);
    zip.file('ppt/_rels/presentation.xml.rels', newPresRelsXml);

    // [app.xml] - 슬라이드 개수 업데이트
    const appXml = zip.file('docProps/app.xml')?.asText();
    if (appXml) {
        let newAppXml = appXml.replace(/<Slides>\d+<\/Slides>/, `<Slides>${count}</Slides>`);
        // vt:vector size 업데이트 및 추가 lpstr 삽입
        const vtMatch = newAppXml.match(/<vt:vector[^>]+size="(\d+)"[^>]+baseType="lpstr">([\s\S]*?)<\/vt:vector>/);
        if (vtMatch) {
            const firstLpstr = vtMatch[2].match(/<vt:lpstr>[\s\S]*?<\/vt:lpstr>/)?.[0] || "<vt:lpstr>Slide 1</vt:lpstr>";
            let newLpstrs = firstLpstr;
            for (let i = 2; i <= count; i++) newLpstrs += `<vt:lpstr>Slide ${i}</vt:lpstr>`;
            
            const updatedVector = vtMatch[0]
                .replace(/size="\d+"/, `size="${count}"`)
                .replace(vtMatch[2], newLpstrs);
            newAppXml = newAppXml.replace(vtMatch[0], updatedVector);
        }
        zip.file('docProps/app.xml', newAppXml);
    }
}

/**
 * PPT 템플릿과 데이터를 머지하여 PPT를 생성합니다.
 */
export async function generatePptFromTemplate(pptTemplateFile, dataRows, generationMode = 'single', chunkSizeArg = 10) {
    const templateArrayBuffer = await pptTemplateFile.arrayBuffer();

    if (generationMode === 'single') {
        try {
            const zip = new PizZip(templateArrayBuffer);
            const templateChunkSize = detectTemplateChunkSize(zip);
            const slideCount = Math.ceil(dataRows.length / templateChunkSize);
            
            console.log(`PPT v15 Patching: Rows=${dataRows.length}, ChunkSize=${templateChunkSize}, Slides=${slideCount}`);
            
            duplicateSlides(zip, slideCount, templateChunkSize);

            const doc = new Docxtemplater(zip, {
                paragraphLoop: true,
                linebreaks: true,
                nullGetter() { return ''; }
            });

            const flatData = {};
            dataRows.forEach((rowObj, idx) => {
                const rowNum = idx + 1;
                for (const key in rowObj) flatData[`${key}_${rowNum}`] = rowObj[key];
            });

            doc.render(flatData);

            const blob = doc.getZip().generate({
                type: 'blob',
                mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
            });

            saveAs(blob, '통합_데이터_리포트.pptx');
        } catch (error) {
            console.error('단일 PPT 생성 오류:', error);
            throw error;
        }
    } else {
        // 분할 모드 등 (필요시 duplicateSlidesV15 적용)
    }
}

async function createAndDownloadZip(files, zipFileName) {
    const zip = new JSZip();
    for (const file of files) zip.file(file.name, file.blob);
    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, zipFileName);
}
