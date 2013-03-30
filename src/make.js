var XWiki = require('xwiki-tools');

var doc = new XWiki.model.XWikiDoc(["XWiki","TableEdit"]);
doc.setContent("{{info}}\nThis document contains code for XWiki.TableEdit extension.\n{{/info}}");
doc.setTitle("XWiki TableEdit");

var obj = new XWiki.model.JavaScriptExtension();
obj.setCode(XWiki.Tools.contentFromFile("./src/js/tableedit.js"));
doc.addXObject(obj);

doc.addAttachment("src/attach/jquery-sheet-amd.zip");


// Post to a wiki?
// must post to a /preview/ page, for example:
// syntax  ./do --post Admin:admin@192.168.1.1:8080/xwiki/bin/preview//
var i = process.argv.indexOf('--post');
if (i > -1) {
    var userUrl = process.argv[i+1].split('@').reverse();
    XWiki.Tools.postDocToWiki(userUrl[1], userUrl[0], doc, function() {
        console.log("done");
    });

} else {

    /*
    var BufferedWriter = require('buffered-writer');
    var stream = BufferedWriter.open("output.xml");
    XWiki.XML.write(doc.json, stream, function() {
        stream.close();
        console.log('done');
    });
    */

    var pack = new XWiki.Package();
    pack.setName("XWiki - Contrib - XWiki.TableEdit");
    pack.setDescription("An editor which allows you to edit XWiki tables as spreadsheets using " +
        "Jquery.sheet.");
    pack.setExtensionId("org.xwiki.contrib:xwiki-contrib-tableedit");
    pack.addDocument(doc);
    pack.beginZip('XWiki.TableEdit.xar');
    pack.finalize();
}
