var XWiki = require('xwiki-tools');

var doc = new XWiki.model.XWikiDoc(["XWiki","TableEdit"]);
doc.setContent("{{info}}\nThis document contains code for XWiki.TableEdit extension.\n{{/info}}");
doc.setTitle("XWiki TableEdit");

var obj = new XWiki.model.JavaScriptExtension();
obj.setCode(XWiki.Tools.contentFromFile("./src/js/tableedit.js"));
doc.addXObject(obj);

doc.addAttachment("src/main/resources/attachments/jquery-sheet-amd.zip");

/*
var BufferedWriter = require('buffered-writer');
var stream = BufferedWriter.open("output.xml");
xwiki.XMLWriter.write(doc.json, stream, function() {
    stream.close();
    console.log('done');
});*/

var pack = new XWiki.Package();
pack.setName("XWiki - Contrib - XWiki.TableEdit");
pack.setDescription("An editor which allows you to edit XWiki tables as spreadsheets using " +
    "Jquery.sheet.");
pack.setExtensionId("org.xwiki.contrib:xwiki-contrib-tableedit");
pack.addDocument(doc);
pack.beginZip('XWiki.TableEdit.xar');
pack.finalize();
