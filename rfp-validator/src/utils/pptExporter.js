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
 * PPT 템플릿과 데이터를 머지하여 PPT를 생성합니다.
 * @param {File} pptTemplateFile - 사용자가 업로드한 원본 .pptx 템플릿
 * @param {Array} dataRows - 엑셀에서 추출한 JSON 배열 (각 행을 의미)
 * @param {string} generationMode - 'chunk' (분할) 또는 'multiple' (개별 파일)
 * @param {number} chunkSize - 분할 모드일 때 표 하나에 들어갈 행의 개수
 */
export async function generatePptFromTemplate(pptTemplateFile, dataRows, generationMode = 'chunk', chunkSize = 10) {
    const templateArrayBuffer = await pptTemplateFile.arrayBuffer();

    if (generationMode === 'chunk') {
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

                // docxtemplater 무료 버전은 PPTX 표 반복({#items})을 지원하지 않으므로,
                // 데이터를 name_1, name_2 형태로 평탄화(Flatten)하여 주입합니다.
                const flatData = {};
                chunk.forEach((rowObj, idx) => {
                    const rowNum = idx + 1;
                    for (const key in rowObj) {
                        flatData[`${key}_${rowNum}`] = rowObj[key];
                    }
                });

                // 10개 행이 꽉 차지 않을 경우 빈 칸을 위해 공백 문자열 주입
                const headers = dataRows.length > 0 ? Object.keys(dataRows[0]) : [];
                for (let i = chunk.length + 1; i <= chunkSize; i++) {
                    for (const key of headers) {
                        flatData[`${key}_${i}`] = '';
                    }
                }

                // 평탄화된 데이터로 단순 텍스트 치환 렌더링
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
            await createAndDownloadZip(generatedFiles, '10건분할_PPT_모음.zip');
        }

    } else if (generationMode === 'multiple') {
        // --- 모드: 엑셀 행당 1개의 PPT 생성 ---
        const generatedFiles = [];
        let index = 1;

        for (const rowData of dataRows) {
            try {
                // 매 반복마다 원본 버퍼 복사
                const zip = new PizZip(templateArrayBuffer);
                const doc = new Docxtemplater(zip, {
                    paragraphLoop: true,
                    linebreaks: true,
                    nullGetter() { return ''; } // 값이 없으면 빈칸
                });

                // 현재 행 데이터로 렌더링
                doc.render(rowData);

                const blob = doc.getZip().generate({
                    type: 'blob',
                    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
                });

                // 파일명 (첫 번째 키의 값을 이름으로 사용하거나 숫자로)
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
            // 파일이 1개면 구태여 압축하지 않음
            saveAs(generatedFiles[0].blob, generatedFiles[0].name);
        } else if (generatedFiles.length > 1) {
            // 여러 개일 경우 ZIP 생성
            await createAndDownloadZip(generatedFiles, '생성된_PPT_모음.zip');
        }
    }
}
