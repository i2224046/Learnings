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

    // ==========================================
    // 【追加】インデントと不要な改行の初期化（リセット）
    // ==========================================
    // ① 全行の行頭・行末の空白（前回のインデントなど）を一度リセット
    var rawLines = text.split("\n");
    for (var l = 0; l < rawLines.length; l++) {
        rawLines[l] = rawLines[l].replace(/^\s+|\s+$/g, "");
    }
    text = rawLines.join("\n");

    // ② インライン要素の内部にある不要な改行を削除して1行に修復
    // 再実行時に、一度崩れてしまった <label> や <a> などのタグとテキストの隙間を初期化する
    var inlineWrapTags = "label|span|a|button|strong|b|i|em";
    var wrapRegex = new RegExp("<(" + inlineWrapTags + ")\\b[^>]*>[\\s\\S]*?<\\/\\1>", "ig");
    text = text.replace(wrapRegex, function(match) {
        // 中にPHPコードが含まれている場合は安全のため改行を維持
        if (match.indexOf("<?") !== -1) {
            return match;
        }
        // タグ内部の改行をすべて削除してピッタリつなげる
        return match.replace(/\n/g, "");
    });

    // 2. タグ同士が連続している部分に改行を挿入
    text = text.replace(/(>|\?>)(\s*)(<|<\?php|<\?=)/ig, function(match, p1, p2, p3, offset, string) {
        var hasNewline = p2.indexOf('\n') !== -1;
        
        // 直前・直後の文字列を抽出
        var prevStr = string.substring(Math.max(0, offset - 50), offset + p1.length);
        var nextStartIndex = offset + p1.length + p2.length;
        var nextStr = string.substring(nextStartIndex, Math.min(string.length, nextStartIndex + 50));
        
        // タグ名を取得
        var prevTagMatch = prevStr.match(/<(\/)?([a-z0-9]+)[^>]*>$/i);
        var nextTagMatch = nextStr.match(/^(<)(\/)?([a-z0-9]+)/i);

        var prevTag = prevTagMatch ? prevTagMatch[2].toLowerCase() : "";
        var nextTag = (nextTagMatch && nextTagMatch[3]) ? nextTagMatch[3].toLowerCase() : "";
        
        // 直前・直後のタグが閉じタグかどうかを判定
        var prevIsClose = prevTagMatch ? !!prevTagMatch[1] : false;
        var nextIsClose = nextTagMatch ? !!nextTagMatch[2] : false;
        
        // スペースを開けたくないインライン要素のリスト
        var inlineTags = /^(label|input|span|a|img|button|strong|b|i|em|textarea|select|option)$/i;
        // インライン要素を直接囲むことが多く、改行を避けたいブロック要素のリスト
        var inlineContainers = /^(p|h[1-6]|li|td|th)$/i;

        // パターン1: 両方がインライン要素の場合（例: <label><input> や </label><label>）
        if (inlineTags.test(prevTag) && inlineTags.test(nextTag)) {
            // 表示崩れを防ぐため、強制的に改行を削除してつなげる
            return p1 + p3;
        }

        // パターン2: コンテナ開きタグ -> インライン要素（例: <p><label>）
        if (inlineContainers.test(prevTag) && !prevIsClose && inlineTags.test(nextTag)) {
            return p1 + p3;
        }

        // パターン3: インライン要素 -> コンテナ閉じタグ（例: </label></p>）
        if (inlineTags.test(prevTag) && inlineContainers.test(nextTag) && nextIsClose) {
            return p1 + p3;
        }

        // パターン4: インライン要素 -> <br> の場合は改行を削除してつなげる（例: </label><br>）
        if (inlineTags.test(prevTag) && nextTag === "br") {
            return p1 + p3;
        }

        // それ以外（ブロック要素など）は改行を入れる
        return p1 + "\n" + p3;
    });

    // 行ごとに分割
    var lines = text.split("\n");
    var indentLevel = 0;
    var indentStr = "\t"; // インデントをタブ文字に設定
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

    // 置換時に無駄な改行が増えないように末尾の改行を削って返す
    return out.replace(/\n$/, "");
}