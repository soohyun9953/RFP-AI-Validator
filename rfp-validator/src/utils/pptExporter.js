import * as XLSX from 'xlsx';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { saveAs } from 'file-saver';
import JSZip from 'jszip'; // For zipping multiple files if needed

/**
 * 엑셀 데이터를 JSON 객체 배열로 파싱합니다.
 */
export async function parseExcelData(file) {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    
    // 첫 번째 시트를 기준으로 데이터 파싱
    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];
    
    // header: 1 옵션을 빼면 첫 번째 행의 값을 키(Key)로 하는 객체 배열 리턴
    const jsonRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    return jsonRows;
}

/**
 * PizZip을 이용해 여러 파일을 하나로 묶어 다운로드
 */
async function createAndDownloadZip(files, zipFileName) {
    const zip = new JSZip();
    for (const file of files) {
        zip.file(file.name, file.blob);
    }
    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, zipFileName);
}

/**
 * PPTX 내부 XML 구조를 조작하여 슬라이드를 복제합니다.
 */
function duplicateSlides(zip, count) {
    if (count <= 1) return;

    // 1. [Content_Types].xml 업데이트
    const contentTypesXml = zip.file('[Content_Types].xml').asText();
    const parser = new DOMParser();
    const ctDoc = parser.parseFromString(contentTypesXml, 'text/xml');
    const typesEl = ctDoc.getElementsByTagName('Types')[0];
    
    // 2. ppt/presentation.xml 업데이트 (슬라이드 ID 리스트)
    const presXml = zip.file('ppt/presentation.xml').asText();
    const presDoc = parser.parseFromString(presXml, 'text/xml');
    const sldIdLst = presDoc.getElementsByTagName('p:sldIdLst')[0];
    
    // 3. ppt/_rels/presentation.xml.rels 업데이트 (관계 정보)
    const relsXml = zip.file('ppt/_rels/presentation.xml.rels').asText();
    const relsDoc = parser.parseFromString(relsXml, 'text/xml');
    const relationshipsEl = relsDoc.getElementsByTagName('Relationships')[0];

    // 기존 슬라이드 정보 및 관계 ID 확인
    const lastSldIdEl = sldIdLst.lastElementChild;
    let nextSldId = parseInt(lastSldIdEl.getAttribute('id')) + 1;
    
    // rId 찾기 (가장 큰 rId 번호를 찾아서 그 다음부터 생성)
    const allRels = Array.from(relationshipsEl.getElementsByTagName('Relationship'));
    let maxRIdNum = 0;
    allRels.forEach(rel => {
        const rIdMatch = rel.getAttribute('Id').match(/rId(\d+)/);
        if (rIdMatch) maxRIdNum = Math.max(maxRIdNum, parseInt(rIdMatch[1]));
    });

    const slide1Xml = zip.file('ppt/slides/slide1.xml').asText();
    const slide1RelsFile = zip.file('ppt/slides/_rels/slide1.xml.rels');
    const slide1RelsXml = slide1RelsFile ? slide1RelsFile.asText() : null;

    for (let i = 2; i <= count; i++) {
        const rId = `rId${++maxRIdNum}`;
        const slideName = `slide${i}.xml`;
        const slidePath = `ppt/slides/${slideName}`;

        // [Content_Types].xml 에 슬라이드 추가
        const override = ctDoc.createElement('Override');
        override.setAttribute('PartName', `/${slidePath}`);
        override.setAttribute('ContentType', 'application/vnd.openxmlformats-officedocument.presentationml.slide+xml');
        typesEl.appendChild(override);

        // ppt/presentation.xml 에 슬라이드 ID 추가
        const sldId = presDoc.createElement('p:sldId');
        sldId.setAttribute('id', String(nextSldId++));
        sldId.setAttribute('r:id', rId);
        sldIdLst.appendChild(sldId);

        // ppt/_rels/presentation.xml.rels 에 관계 추가
        const rel = relsDoc.createElement('Relationship');
        rel.setAttribute('Id', rId);
        rel.setAttribute('Type', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide');
        rel.setAttribute('Target', `slides/${slideName}`);
        relationshipsEl.appendChild(rel);

        // 실제 슬라이드 파일 생성
        zip.file(slidePath, slide1Xml);
        if (slide1RelsXml) {
            zip.file(`ppt/slides/_rels/${slideName}.rels`, slide1RelsXml);
        }
    }

    const serializer = new XMLSerializer();
    zip.file('[Content_Types].xml', serializer.serializeToString(ctDoc));
    zip.file('ppt/presentation.xml', serializer.serializeToString(presDoc));
    zip.file('ppt/_rels/presentation.xml.rels', serializer.serializeToString(relsDoc));
}

/**
 * PPT 템플릿과 데이터를 머지하여 PPT를 생성합니다.
 */
export async function generatePptFromTemplate(pptTemplateFile, dataRows, generationMode = 'chunk', chunkSize = 10) {
    const templateArrayBuffer = await pptTemplateFile.arrayBuffer();

    if (generationMode === 'single') {
        // --- 모드: 1개의 파일에 모든 데이터를 각각의 슬라이드로 생성 (복제 방식) ---
        try {
            const zip = new PizZip(templateArrayBuffer);
            
            // 데이터 개수만큼 슬라이드 복제
            duplicateSlides(zip, dataRows.length);

            const doc = new Docxtemplater(zip, {
                paragraphLoop: true,
                linebreaks: true,
                nullGetter() { return ''; }
            });

            // 각 슬라이드의 태그를 field_N 형식으로 매핑 (예: {이름_1}, {이름_2} ...)
            const flatData = {};
            dataRows.forEach((rowObj, idx) => {
                const rowNum = idx + 1;
                for (const key in rowObj) {
                    flatData[`${key}_${rowNum}`] = rowObj[key];
                }
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
    } else if (generationMode === 'chunk') {
        // --- 모드: 사용자가 지정한 갯수(chunkSize)씩 묶어서 여러 개의 PPT 파일 생성 ---
        const generatedFiles = [];
        let fileIndex = 1;

        for (let i = 0; i < dataRows.length; i += chunkSize) {
            const chunk = dataRows.slice(i, i + chunkSize);
            try {
                const zip = new PizZip(templateArrayBuffer);
                const doc = new Docxtemplater(zip, {
                    paragraphLoop: true,
                    linebreaks: true,
                    nullGetter() { return ''; }
                });

                const flatData = {};
                chunk.forEach((rowObj, idx) => {
                    const rowNum = idx + 1;
                    for (const key in rowObj) {
                        flatData[`${key}_${rowNum}`] = rowObj[key];
                    }
                });

                const headers = dataRows.length > 0 ? Object.keys(dataRows[0]) : [];
                for (let i = chunk.length + 1; i <= chunkSize; i++) {
                    for (const key of headers) {
                        flatData[`${key}_${i}`] = '';
                    }
                }

                doc.render(flatData);

                const blob = doc.getZip().generate({
                    type: 'blob',
                    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
                });

                const startIndex = i + 1;
                const endIndex = i + chunk.length;
                generatedFiles.push({ name: `PPT_${startIndex}번_부터_${endIndex}번까지.pptx`, blob });
                fileIndex++;
            } catch (error) {
                console.error(`분할 PPT 생성 오류 (chunk ${fileIndex}):`, error);
                throw error;
            }
        }

        if (generatedFiles.length === 1) {
            saveAs(generatedFiles[0].blob, generatedFiles[0].name);
        } else if (generatedFiles.length > 1) {
            await createAndDownloadZip(generatedFiles, '분할_PPT_모음.zip');
        }

    } else if (generationMode === 'multiple') {
        // --- 모드: 엑셀 행당 1개의 PPT 생성 ---
        const generatedFiles = [];
        let index = 1;

        for (const rowData of dataRows) {
            try {
                const zip = new PizZip(templateArrayBuffer);
                const doc = new Docxtemplater(zip, {
                    paragraphLoop: true,
                    linebreaks: true,
                    nullGetter() { return ''; }
                });

                doc.render(rowData);

                const blob = doc.getZip().generate({
                    type: 'blob',
                    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
                });

                const firstValue = Object.values(rowData)[0];
                const cleanName = firstValue ? String(firstValue).replace(/[/\\?%*:|"<>]/g, '_') : `PPT_${index}`;
                generatedFiles.push({ name: `${cleanName}.pptx`, blob });
                index++;
            } catch (error) {
                console.error(`PPT 생성 중 오류 발생 (행 ${index}):`, error);
                throw error;
            }
        }

        if (generatedFiles.length === 1) {
            saveAs(generatedFiles[0].blob, generatedFiles[0].name);
        } else if (generatedFiles.length > 1) {
            await createAndDownloadZip(generatedFiles, '생성된_PPT_모음.zip');
        }
    }
}

