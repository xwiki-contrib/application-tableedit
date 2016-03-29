(function()
{
    ## VELOCITY
    ##
    var REQUIREJS_JS = "$doc.getAttachmentURL('require.js')";
    var JQS_ATTACH_URL = "$doc.getAttachmentURL('jquery-sheet-amd.zip')";
    var SCRIPTACULOUS_JS = "$xwiki.getSkinFile('resources/js/scriptaculous/scriptaculous.js', true)";
    var LIGHTBOX_CSS = "$xwiki.getURL('XWiki.ModalBox', 'ssx')";
    var LIGHTBOX_JS = "$xwiki.getURL('XWiki.ModalBox', 'jsx')?minify=false";
    ##
    ## END VELOCITY

    // constants
    var HEADER_ROW_STYLE = "background-color:#EEEEEE";
    var MODALBOX_WIDTH = window.innerWidth - 100;
    var MODALBOX_HEIGHT = window.innerHeight - 100;
    var IFRAME_ID = 'jquery-sheet-iframe';
    var IFRAME_STYLE = 'width:100%;height:90%;border:none;';
    var IN_IFRAME_CSS =
        '.jSheetTabContainer { display:none; } '
      + 'body { overflow:hidden }'
    ;
    var console = { 'log':function(){} };

    (function() {
        var head = document.getElementsByTagName('head')[0];

        // Get the CSS files.
        var cssFiles = [LIGHTBOX_CSS];
        for (var i = 0; i < cssFiles.length; i++) {
            var css = document.createElement('link');
            css.setAttribute('rel', 'stylesheet');
            css.setAttribute('type', 'text/css');
            css.setAttribute('href', cssFiles[i]);
            head.appendChild(css);
        }

        var jsFiles = [SCRIPTACULOUS_JS, LIGHTBOX_JS];

        // Get require.js if it is not already provided.
        try { require.config } catch (e) { jsFiles.push(REQUIREJS_JS); }

        for (var i = 0; i < jsFiles.length; i++) {
            var head = document.getElementsByTagName('head')[0];
            var scr = document.createElement('script');
            scr.setAttribute('src', jsFiles[i]);
            scr.setAttribute('type', 'text/javascript');
            head.appendChild(scr);
        }
    })();

    var jQuerySheetToWikiText = function(jqSheet)
    {
        var lines = [];
        var data = jqSheet[0].data;
        for (var row in data) {
            var outRow = [];
            var isHeaderRow = 0;
            var column;
            for (var i = 0; column = data[row]['c'+i]; i++) {
                if (column.value) { outRow[i] = column.value; }
                // The only way to extract information after the form is serialized is
                // through the style, firefox converts #ffffff to "rgb(255,255,255)"
                //isHeaderRow = isHeaderRow || (column.style == HEADER_ROW_STYLE);
                isHeaderRow = isHeaderRow || (column.style != undefined && column.style != "undefined");
            }
            if (outRow.length > 0) {
                outRow.unshift('');
                lines.push(outRow.join(isHeaderRow ? '|=' : '|'));
            }
        }
        return (lines.length) ? lines.join('\n') : '';
    };

    var wikiTableToJquerySheet = function(wikiTable)
    {
        var out = [{}];
        var meta = out[0].metadata = {};
        var data = out[0].data = {};

        meta.rows = wikiTable.length;
        meta.columns = 0;

        for (var i = 0; i < wikiTable.length; i++) {
            meta.columns = Math.max(meta.columns, wikiTable[i].length);
        }

        for (var i = 0; i < meta.rows; i++) {
            var row = wikiTable[i] || {};
            var outRow = data['r' + i] = {};

            // TODO make configurable.
            outRow.h = '18px';

            for (var j = 0; j < meta.columns; j++) {
                outRow['c' + j] = {
                    "value": (j < row.length-1) ? row[j+1] : "",
                    "style": (row[0] == 'th') ? HEADER_ROW_STYLE : "",
                    "colspan": null,
                    "cl": ""
                };
            }
        }
        return out;
    };

    /**
     * @param wikiText some xwiki/2.0 syntax text.
     * @return an array of tables which were found in the text.
     *         output[n].beginLine := the line in the content where this table begins.
     *         output[n].endLine := the first line following the table content.
     *         output[n].data := an array of rows.
     *         output[n].data[x] := an array of columns.
     *         output[n].data[x][0] := 'th' if this row is a header, otherwise 'td'.
     *         output[n].data[x][y] := the content of column y-1 in row x, table n.
     */
    var getTablesFromWikiText = function(wikiText)
    {
        var HEADER_REGEX = /^\|\=.*$/;
        var CONTENT_REGEX = /^\|.*$/;
        var wikiLines = wikiText.split('\n');
        var tables = [];
        var currentTable = {};
        for (var i = 0; i < wikiLines.length; i++) {
            // if the last char is a \r then remove it.
            if (wikiLines[i][wikiLines[i].length-1] === '\r') {
                wikiLines[i] = wikiLines[i].substring(0,wikiLines[i].length-1);
            }
            var fields;
            if (HEADER_REGEX.test(wikiLines[i])) {
                fields = wikiLines[i].split('|=');
                fields[0] = 'th';
            } else if (CONTENT_REGEX.test(wikiLines[i])) {
                fields = wikiLines[i].split('|');
                fields[0] = 'td';
            } else {
                if (currentTable.data) {
                    currentTable.endLine = i;
                    tables.push(currentTable);
                    currentTable = {};
                }
                continue;
            }
            (currentTable.data = currentTable.data || []).push(fields);
            if (currentTable.beginLine === undefined) { currentTable.beginLine = i; }
        }
        if (currentTable.data) {
            currentTable.endLine = wikiLines.length;
            tables.push(currentTable);
        }
        tables.wikiText = wikiText;
        return tables;
    };

    var contentFromRestPage = function(responseXML)
    {
        return responseXML.getElementsByTagName('page')[0]
            .getElementsByTagName('content')[0]
                .childNodes[0]
                    .textContent;
    };

    var createButton = function()
    {
        var spn = document.createElement('span');
        spn.setAttribute('class', 'buttonwrapper');
        var input = document.createElement('a');
        input.setAttribute('href', 'javascript:void(0)');
        spn.appendChild(input);
        return input;
    };

    var getMeta = function(name)
    {
        var metas = document.getElementsByTagName('meta');
        for (var i = 0 ; i < metas.length; i++) {
            if (metas[i].name === name) { return metas[i].content; }
        }
    };

    var saveContent = function(content, andThen)
    {
        var params = {
            form_token: getMeta('form_token'),
        //    x-maximized: '',
        //    parent:
        //    title:
        //    xcontinue:/xwiki/bin/edit/Test/GetContent?editor=wiki
        //    xredirect:
        //    language:en
            content: content,
            xeditaction: 'edit',
            comment: 'Edited table using XWiki.TableEdit',
            action_saveandcontinue: 'Save & Continue',
            syntaxId: XWiki.docsyntax,
        //    xhidden: 0,
            minorEdit: 0,
            ajax: true
        };

        var savingMessage = new XWiki.widgets.Notification("Saving Table", "saving");
        new Ajax.Request(window.docsaveurl, {
            method: 'post',
            parameters: params,
            onSuccess: function(ret) {
                savingMessage.hide();
                new XWiki.widgets.Notification("Saved", "done");
                andThen(true);
            },
            onFailure: function() {
                savingMessage.hide();
                new XWiki.widgets.Notification("Failed to save table", "error");
                andThen(false);
            }
        });
    };

    var postSpawn = function(thisSheet, jSheet, data, wikiText, containerDiv)
    {
        var iframe = containerDiv.firstChild;
        var ifrDoc = iframe.contentDocument;

        // Append our inside-of-iframe CSS
        (function(){
            var inIfrCss = ifrDoc.createElement('style');
            inIfrCss.innerHTML = IN_IFRAME_CSS;
            ifrDoc.getElementsByTagName('head')[0].appendChild(inIfrCss);
        })();

        // When it's done loading, open our sheet.
        var jqs = wikiTableToJquerySheet(data.data);
        thisSheet.openSheet(jSheet.makeTable.json(jqs));

        var saveButton = createButton();
        saveButton.innerHTML = 'Save';
        containerDiv.appendChild(saveButton.parentNode);
        Event.observe(saveButton, 'click', function() {
            var jqsOutput = thisSheet.exportSheet.json();
            var wikiTextOutput = jQuerySheetToWikiText(jqsOutput);
            var lines = wikiText.split('\n');
            var outLines = [];
            for (var i = 0; i < lines.length; i++) {
                if (i < data.beginLine || i >= data.endLine) {
                    outLines.push(lines[i]);
                } else if (i === data.beginLine) {
                    outLines.push(wikiTextOutput);
                }
            }
            var result = outLines.join('\n');
            saveContent(result, function() {
                Modalbox.hide();
            });
        });

        var cancelButton = createButton();
        cancelButton.innerHTML = 'Cancel';
        containerDiv.appendChild(cancelButton.parentNode);
        Event.observe(cancelButton, 'click', function() { Modalbox.hide(); });

        // TODO: find a way to trap the click so we don't have to poll.
        var timeout = setInterval(function() {
            var menu = ifrDoc.getElementById('jSheetBarLeftMenu_0');
            if (!menu) { return; }
            clearTimeout(timeout);
            var div = ifrDoc.createElement('div');
            div.innerHTML = 'Make Header Row';
            Event.observe(div, 'click', function() {
                // Back in jqueryland
                var tds = thisSheet.obj.cellActive().closest('tr').find('td');
                var oldStyle;
                for (var i = 0; i < tds.length; i++) {
                    oldStyle = oldStyle || tds[i].getAttribute('style');
                    if (oldStyle == HEADER_ROW_STYLE) {
                        tds[i].removeAttribute("style");
                    } else {
                        tds[i].setAttribute('style', HEADER_ROW_STYLE);
                    }
                }
            });
            menu.appendChild(div);
        }, 1);
    };

    var afterModalboxOpens = function(table, wikiText, containerDiv)
    {
        // We need to set the iframe's style before creating it.
        var ifrCss = document.createElement('style');
        ifrCss.innerHTML = '#' + IFRAME_ID + ' { ' + IFRAME_STYLE + ' }';
        document.getElementsByTagName('head')[0].appendChild(ifrCss);

        require([JQS_ATTACH_URL + "/main.js"], function(sheet) {
            sheet.inject(containerDiv, {
                title: '',
                inlineMenu: undefined,
                buildSheet: true,
                editable: true,
                autoFiller: true,
                urlMenu: false,
                minSize: {rows: 25, cols: 10},

                // xwiki table doesn't support calculations.
                calcOff: true,

                height: MODALBOX_HEIGHT - 80,//- 120,
                width: MODALBOX_WIDTH - 40,

                jqs_amd: {
                    id: IFRAME_ID,
//                    scrollTo: true,
//                    jQueryUI: true,
//                    raphaelJs: true,
//                    colorPicker: true,
//                    elastic: true,
//                    advancedMath: true,
//                    finance: true,
                    style:'width:99%;margin-left:auto;margin-right:auto'
                }
            }, function(thisSheet, jSheet) {
                postSpawn(thisSheet, jSheet, table, wikiText, containerDiv);
            });
        });
    };

    var spawnJqs = function(tableFromWikiText, wikiText)
    {
        require.config({
              paths: {
                  "tableedit_jquery": JQS_ATTACH_URL + "/jquery.min"
              }
        });

        // begin downloading requirements.
        require([JQS_ATTACH_URL + "/main.js"], function(sheet) { });

        // Passing the ID doesn't work because ModalBox clones the object and mangles the ID.
        var injectLocationClass = 'j-' + Math.random().toString().replace('0.', '');
        var injectLocation = document.createElement('div');
        injectLocation.setAttribute('class', injectLocationClass);
        injectLocation.setAttribute('style', 'width:100%;height:100%');

        Modalbox.show(injectLocation, {
            height: MODALBOX_HEIGHT,
            width: MODALBOX_WIDTH,
            afterHide:function() { window.location.reload(); },
            afterLoad:function() {
                afterModalboxOpens(tableFromWikiText,
                                   wikiText,
                                   document.getElementsByClassName(injectLocationClass)[0]);
            }
        });
    };

    var gotTables = function(tables, tablesFromWikiText, wikiText)
    {
        for (var i = 0; i < tables.length; i++) {
            if (tables[i].getAttribute('class') == 'xwiki-livetable') {
                tables.splice(i--, 1);
            }
        }
        if (tablesFromWikiText.length != tables.length) {
            console.log("table number mismatch");
            return;
        }
        for (var i = 0; i < tables.length; i++) {
            var img = document.createElement('img');
            img.setAttribute('src', '/xwiki/resources/icons/silk/pencil_add.png');
            var link = document.createElement('a');
            link.setAttribute('href', 'javascript:void(0)// Edit this table as a spreadsheet.');
            link.appendChild(img);
            tables[i].parentNode.insertBefore(link, tables[i]);
            tables[i].setAttribute('style', 'margin-top:0');
            (function() {
                var tableNumber = i;
                Event.observe(link, 'click', function() {
                    spawnJqs(tablesFromWikiText[tableNumber], wikiText);
                });
            })();
        }
    };

    Event.observe(document, 'dom:loaded', function() {
        if (!XWiki.hasEdit || XWiki.docsyntax.indexOf('xwiki/2.')) {
            // unsupported.
            return;
        }
        var tables = document.getElementsByTagName('table');
        if (!tables.length) {
            // no tables.
            return;
        }
        new Ajax.Request(XWiki.currentDocument.getRestURL(), {
            method: 'get',
            onSuccess: function(ret) {
                var wikiText = contentFromRestPage(ret.responseXML);
                var tablesFromWikiText = getTablesFromWikiText(wikiText);
                gotTables(tables, tablesFromWikiText, wikiText);
            },
            onFailure: function() { console.log('failed'); }
        });
    });
})();