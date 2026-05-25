// Two-column PDF export with textbook-style layout

function exportToPDF() {
    const btn = document.getElementById('export-pdf');
    const originalText = btn.innerHTML;
    btn.innerHTML = '⏳<span class="icon-label">Generating...</span>';
    btn.disabled = true;

    setTimeout(() => {
        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ unit: 'mm', format: 'a4' });

            // Page constants
            const pageW = doc.internal.pageSize.getWidth();   // 210
            const pageH = doc.internal.pageSize.getHeight();  // 297
            const margin = 10;
            const headerH = 12;
            const footerH = 8;
            const colGap = 6;
            const colW = (pageW - 2 * margin - colGap) / 2;
            const colTop = margin + headerH;
            const colBottom = pageH - margin - footerH;

            const cols = [
                { x: margin, y: colTop },
                { x: margin + colW + colGap, y: colTop }
            ];
            let curCol = 0;
            let pageNum = 1;

            // Helper: get current Y in active column
            const getY = () => cols[curCol].y;
            const setY = (y) => { cols[curCol].y = y; };
            const getX = () => cols[curCol].x;

            // Drawing helpers
            function drawHeader(sectionTitle) {
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(11);
                doc.setTextColor(0, 51, 102);
                doc.text('Obstetric & Maternal Health Nursing - MCQs', margin, margin + 5);
                doc.setFont('helvetica', 'italic');
                doc.setFontSize(8);
                doc.setTextColor(120, 120, 120);
                doc.text(`Section: ${sectionTitle}`, pageW - margin, margin + 5, { align: 'right' });
                doc.setDrawColor(0, 51, 102);
                doc.setLineWidth(0.4);
                doc.line(margin, margin + 8, pageW - margin, margin + 8);
                // Vertical column divider
                doc.setDrawColor(180, 180, 180);
                doc.setLineWidth(0.2);
                doc.line(pageW / 2, colTop, pageW / 2, colBottom);
            }

            function drawFooter() {
                doc.setFont('helvetica', 'italic');
                doc.setFontSize(8);
                doc.setTextColor(150, 150, 150);
                doc.text(`Page ${pageNum}`, pageW / 2, pageH - margin, { align: 'center' });
            }

            function newPage(sectionTitle) {
                drawFooter();
                doc.addPage();
                pageNum++;
                cols[0].y = colTop;
                cols[1].y = colTop;
                curCol = 0;
                drawHeader(sectionTitle);
            }

            function checkColumnSpace(needed, sectionTitle) {
                if (getY() + needed > colBottom) {
                    if (curCol === 0) {
                        curCol = 1;
                        if (getY() + needed > colBottom) {
                            newPage(sectionTitle);
                        }
                    } else {
                        newPage(sectionTitle);
                    }
                }
            }

            // First page header
            drawHeader(questions[0].section);

            const letters = ['A', 'B', 'C', 'D'];
            let currentSection = '';

            // Title at very top of first column
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(13);
            doc.setTextColor(0, 51, 102);
            doc.text('OBG MCQs - Practice Set', getX(), getY() + 5);
            setY(getY() + 10);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(100, 100, 100);
            doc.text(`Total: ${questions.length} questions | For Rabiya Black`, getX(), getY() + 4);
            setY(getY() + 8);

            questions.forEach((q, i) => {
                // Section header
                if (q.section !== currentSection) {
                    currentSection = q.section;
                    // Need ~10mm for section header
                    checkColumnSpace(12, currentSection);
                    setY(getY() + 4);
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(9);
                    doc.setTextColor(153, 0, 0);
                    const sectLines = doc.splitTextToSize(currentSection, colW);
                    doc.text(sectLines, getX(), getY());
                    setY(getY() + sectLines.length * 4);
                    doc.setDrawColor(153, 0, 0);
                    doc.setLineWidth(0.3);
                    doc.line(getX(), getY(), getX() + colW, getY());
                    setY(getY() + 3);
                }

                // Compute size needed
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(8.5);
                const qLines = doc.splitTextToSize(`Q${i+1}. ${q.question}`, colW);

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(8);
                let optsTotal = 0;
                const optLinesArr = q.options.map((opt, idx) => {
                    const txt = `${letters[idx]}. ${opt}`;
                    const lines = doc.splitTextToSize(txt, colW - 3);
                    optsTotal += lines.length * 3.5;
                    return lines;
                });

                doc.setFont('helvetica', 'italic');
                doc.setFontSize(7);
                const expLines = doc.splitTextToSize(`Explanation: ${q.rationale}`, colW - 3);

                // Total block height
                const blockHeight = qLines.length * 3.5
                    + 1
                    + optsTotal
                    + 3   // tiny answer line
                    + 3   // top line gap
                    + expLines.length * 3
                    + 3   // bottom line gap
                    + 5;  // spacing after

                checkColumnSpace(blockHeight, currentSection);

                // Question
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(8.5);
                doc.setTextColor(0, 0, 153);
                doc.text(qLines, getX(), getY());
                setY(getY() + qLines.length * 3.5 + 1);

                // Options
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(8);
                doc.setTextColor(0, 0, 0);
                optLinesArr.forEach(lines => {
                    doc.text(lines, getX() + 3, getY());
                    setY(getY() + lines.length * 3.5);
                });

                // Tiny answer at bottom-right of question (below options)
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(5.5);
                doc.setTextColor(180, 180, 180);
                doc.text(`[Ans: ${q.correct}]`, getX() + colW, getY() + 2, { align: 'right' });
                setY(getY() + 3);

                // Top border line for explanation block
                doc.setDrawColor(120, 120, 120);
                doc.setLineWidth(0.2);
                doc.line(getX(), getY(), getX() + colW, getY());
                setY(getY() + 3);

                // Explanation
                doc.setFont('helvetica', 'italic');
                doc.setFontSize(7);
                doc.setTextColor(80, 80, 80);
                doc.text(expLines, getX(), getY());
                setY(getY() + expLines.length * 3);

                // Bottom border line
                setY(getY() + 3);
                doc.setDrawColor(120, 120, 120);
                doc.setLineWidth(0.2);
                doc.line(getX(), getY(), getX() + colW, getY());
                setY(getY() + 5);
            });

            drawFooter();
            doc.save('OBG_MCQs_RabiyaBlack.pdf');
        } catch (err) {
            alert('Error exporting PDF: ' + err.message);
            console.error(err);
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }, 50);
}
