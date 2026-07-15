<?php

namespace App\Support;

use RuntimeException;
use ZipArchive;

/**
 * Minimal Office Open XML (.xlsx) writer for tabular string/number exports.
 */
class SimpleXlsxWriter
{
    /**
     * @param  list<string>  $headers
     * @param  iterable<int, list<string|int|float|null>>  $rows
     */
    public static function toTempFile(array $headers, iterable $rows): string
    {
        if (! class_exists(ZipArchive::class)) {
            throw new RuntimeException('Excel export requires the PHP zip extension.');
        }

        $path = tempnam(sys_get_temp_dir(), 'care-xlsx-');
        if ($path === false) {
            throw new RuntimeException('Unable to create a temporary export file.');
        }

        // ZipArchive needs a real path ending in .xlsx for reliable MIME/download names.
        $xlsxPath = $path.'.xlsx';
        if (! @rename($path, $xlsxPath)) {
            @unlink($path);
            throw new RuntimeException('Unable to prepare the export file.');
        }

        $zip = new ZipArchive;
        if ($zip->open($xlsxPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            @unlink($xlsxPath);
            throw new RuntimeException('Unable to open the export archive.');
        }

        $zip->addFromString('[Content_Types].xml', <<<'XML'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>
XML);

        $zip->addFromString('_rels/.rels', <<<'XML'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>
XML);

        $zip->addFromString('xl/_rels/workbook.xml.rels', <<<'XML'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>
XML);

        $zip->addFromString('xl/workbook.xml', <<<'XML'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Reviews" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>
XML);

        $zip->addFromString('xl/styles.xml', <<<'XML'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills count="1"><fill><patternFill patternType="none"/></fill></fills>
  <borders count="1"><border/></borders>
  <cellStyleXfs count="1"><xf/></cellStyleXfs>
  <cellXfs count="1"><xf/></cellXfs>
</styleSheet>
XML);

        $sheet = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            .'<sheetData>';

        $sheet .= self::rowXml(1, $headers);
        $rowIndex = 2;
        foreach ($rows as $row) {
            $sheet .= self::rowXml($rowIndex, $row);
            $rowIndex++;
        }

        $sheet .= '</sheetData></worksheet>';
        $zip->addFromString('xl/worksheets/sheet1.xml', $sheet);

        if (! $zip->close()) {
            @unlink($xlsxPath);
            throw new RuntimeException('Unable to finalize the export archive.');
        }

        return $xlsxPath;
    }

    /**
     * @param  list<string|int|float|null>  $cells
     */
    private static function rowXml(int $rowIndex, array $cells): string
    {
        $xml = '<row r="'.$rowIndex.'">';
        foreach ($cells as $index => $value) {
            $ref = self::columnLetter($index + 1).$rowIndex;
            if (is_int($value) || is_float($value)) {
                $xml .= '<c r="'.$ref.'"><v>'.$value.'</v></c>';
                continue;
            }

            $text = self::escape((string) ($value ?? ''));
            $xml .= '<c r="'.$ref.'" t="inlineStr"><is><t xml:space="preserve">'.$text.'</t></is></c>';
        }

        return $xml.'</row>';
    }

    private static function columnLetter(int $index): string
    {
        $letter = '';
        while ($index > 0) {
            $index--;
            $letter = chr(65 + ($index % 26)).$letter;
            $index = intdiv($index, 26);
        }

        return $letter;
    }

    private static function escape(string $value): string
    {
        return htmlspecialchars(
            preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/', '', $value) ?? '',
            ENT_QUOTES | ENT_XML1,
            'UTF-8',
        );
    }
}
