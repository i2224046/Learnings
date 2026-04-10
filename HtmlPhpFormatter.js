//========================================================
// サクラエディタ マクロ：HTML/PHP 整形
// ファイル名：HtmlPhpFormatter.js
//========================================================

// 選択範囲がなければ全体を選択
if (Editor.IsTextSelected() == 0) {
    Editor.SelectAll();
}

var text = Editor.GetSelectedString(0);

if (text !== "") {
    var formatted = FormatHTMLPHP(text);
    // 選択範囲を整形後のテキストで上書き置換
    Editor.InsText(formatted);
}

// HTMLとPHPを行単位でインデント付きに整形する関数
function FormatHTMLPHP(text) {
    // 1. 改行コードを LF に統一
    text = text.replace(/\r\n|\r/g, "\n");

    // 2. タグ同士が連続している部分に改行を挿入
    text = text.replace(/(>|\?>)\s*(<|<\?php|<\?=)/ig, "$1\n$2");

    // 行ごとに分割
    var lines = text.split("\n");
    var indentLevel = 0;
    var indentStr = "\t"; // 【変更】インデントをタブ文字に設定
    var out = "";

    for (var i = 0; i < lines.length; i++) {
        var s = lines[i].replace(/^\s+|\s+$/g, ""); // 前後の空白をトリミング
        if (s === "") continue; // 空行はスキップ

        // ==========================================
        // 【1. 現在の行を出力する際のインデントを決定】
        // ==========================================
        var currentIndent = indentLevel;
        var sNoPhp = s.replace(/^<\?(php|=)?\s*/i, ""); // 行頭のPHPタグを無視して判定

        // 行頭が HTMLの終了タグ の場合はインデントを下げる
        if (/^<\//.test(s)) {
            currentIndent--;
        }
        // 行頭が PHPのブロック終了 の場合
        else if (/^(\}|endif|endwhile|endfor|endforeach|endswitch)\b/i.test(sNoPhp)) {
            currentIndent--;
        }
        // 行頭が PHPの中間ブロック (else, elseif など) の場合
        else if (/^(else|elseif|catch|finally)\b/i.test(sNoPhp)) {
            currentIndent--;
        }

        // マイナスにならないように補正
        currentIndent = Math.max(0, currentIndent);

        // --- 行の出力 ---
        var prefix = "";
        for (var j = 0; j < currentIndent; j++) {
            prefix += indentStr;
        }
        out += prefix + s + "\n";

        // ==========================================
        // 【2. 次の行のためのインデントレベルを計算】
        // ==========================================
        // 現在のベース(indentLevel)から、この行に含まれるタグによる純増減を計算する
        var nextIndent = indentLevel;

        // --- HTMLタグの増減 ---
        // コメント、XML宣言などを除くすべてのタグっぽいものを抽出
        var htmlAllTags = (s.match(/<(?!\/|!|\?)[^>]+>/g) || []);
        var htmlCloseTags = (s.match(/<\/[^\s>]+[^>]*>/g) || []);

        // インデントを増やさない単独タグのリスト
        var singleTags = /^(br|img|input|hr|meta|link|base|col|param|area)$/i;
        var openCount = 0;

        for (var k = 0; k < htmlAllTags.length; k++) {
            var tagStr = htmlAllTags[k];
            // /> で終わる自己終了タグはカウントしない
            if (/\/>$/.test(tagStr)) {
                continue;
            }
            var m = tagStr.match(/<([^\s>]+)/);
            if (m && !singleTags.test(m[1])) {
                openCount++;
            }
        }

        var closeCount = htmlCloseTags.length;
        
        // HTMLの純増減を適用
        nextIndent += (openCount - closeCount);

        // --- PHPタグの増減 ---
        var phpOpenBrace = (s.match(/\{/g) || []).length;
        var phpCloseBrace = (s.match(/\}/g) || []).length;
        
        var phpStartKeywords = (s.match(/\b(if|while|for|foreach|switch)\s*\(.*?\)\s*:/gi) || []).length;
        var phpEndKeywords = (s.match(/\b(endif|endwhile|endfor|endforeach|endswitch)\b/gi) || []).length;

        // PHPの純増減を適用
        nextIndent += (phpOpenBrace - phpCloseBrace);
        nextIndent += (phpStartKeywords - phpEndKeywords);

        // 次の行へのインデントレベルを更新
        indentLevel = Math.max(0, nextIndent);
    }

    return out;
}