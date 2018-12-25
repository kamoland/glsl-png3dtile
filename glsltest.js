// GLSLによるPNG標高タイルの3D化実験
// global
var c, cw, ch, mx, my, gl, run;

var uniLocation = new Array();
// テクスチャ用変数の宣言
var texA = new Array(); 
var texG = new Array(); 
var uniTexLocation = new Array();

// 複数タイル対応
var uniLocTileX;
var uniLocTileY;
var yyRange = 4;
var xxRange = 4;

// onload
window.onload = function(){
	// canvas エレメントを取得
	c = document.getElementById('canvas');
	
	// canvas サイズ
	cw = 512; ch = 512;
	c.width = cw; c.height = ch;

	// イベントリスナー登録
	c.addEventListener('mousemove', mouseMove, true);
	
	// WebGL コンテキストを取得
	gl = c.getContext('webgl') || c.getContext('experimental-webgl');
	
	// シェーダ周りの初期化
	var prg = create_program(create_shader('vs'), create_shader('fs'));
	run = (prg != null);
	uniLocation[0] = gl.getUniformLocation(prg, 'time');
	uniLocation[1] = gl.getUniformLocation(prg, 'mouse');
	uniLocation[2] = gl.getUniformLocation(prg, 'resolution');
	
	// 頂点データ回りの初期化
	var position = [
		-1.0,  1.0,  0.0,
		 1.0,  1.0,  0.0,
		-1.0, -1.0,  0.0,
		 1.0, -1.0,  0.0
	];
	var index = [
		0, 2, 1,
		1, 2, 3
	];
	var vPosition = create_vbo(position);
	var vIndex = create_ibo(index);
	var vAttLocation = gl.getAttribLocation(prg, 'position');
	gl.bindBuffer(gl.ARRAY_BUFFER, vPosition);
	gl.enableVertexAttribArray(vAttLocation);
	gl.vertexAttribPointer(vAttLocation, 3, gl.FLOAT, false, 0, 0);
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, vIndex);

	// 処理対象のタイルID
	uniLocTileX = gl.getUniformLocation(prg, 'tileX');
	uniLocTileY = gl.getUniformLocation(prg, 'tileY');
	// 標高タイル
	uniTexLocation[0] = gl.getUniformLocation(prg, 'texture0');
	// 地面画像タイル
	uniTexLocation[1] = gl.getUniformLocation(prg, 'texture1');

	// 使用するタイルのズームレベル
	var tz = 14;
	// 使用するタイル位置の起点
	// 参考
	// http://maps.gsi.go.jp/#14/34.735970/135.239339/&base=std&ls=std%7Cseamlessphoto&blend=0&disp=11&lcd=seamlessphoto&vs=c1j0h0k0l0u0t1z0r0s0f1
	var txs = 14344;
	var tys = 6502;

	var order = 0;
	for (var yy = 0; yy < yyRange; yy++) {
		var ty = tys + yy;
		for (var xx = 0; xx < xxRange; xx++) {
			var tx = txs + xx;

			// 標高タイルをロードする
		    texA[order] = null;
		    create_texture('A', order,
		    	'https://cyberjapandata.gsi.go.jp/xyz/dem_png/' 
		    	+ tz + '/' + tx + '/' + ty + '.png');

			// 地面画像タイルをロードする
		    texG[order] = null;
		    create_texture('G', order,
		    	'https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/'
		    	+ tz + '/' + tx + '/' + ty + '.jpg');
		    order++;
		}
	}

	// その他の初期化
	gl.clearColor(0.0, 0.0, 0.0, 1.0);
	mx = 0.5; my = 0.5;
};

// mouse
function mouseMove(e){
	mx = e.offsetX / cw;
	my = e.offsetY / ch;

	// 再描画
	render();
}

// レンダリングを行う関数
function render(){
	// フラグチェック
	if(!run){return;}
	
	// カラーバッファをクリア
	gl.clear(gl.COLOR_BUFFER_BIT);
	
	// uniform 関連
	gl.uniform1f(uniLocation[0], 0); // timeは未使用
	gl.uniform2fv(uniLocation[1], [mx, my]);
	gl.uniform2fv(uniLocation[2], [cw, ch]);

	var order = 0;
	for (var yy = 0; yy < yyRange; yy++) {
		for (var xx = 0; xx < xxRange; xx++) {
		    // 標高タイル
		    gl.activeTexture(gl.TEXTURE0);
		    gl.bindTexture(gl.TEXTURE_2D, texA[order]);
		    gl.uniform1i(uniTexLocation[0], 0);
		    // 地表面タイル
		    gl.activeTexture(gl.TEXTURE1);
		    gl.bindTexture(gl.TEXTURE_2D, texG[order]);
		    gl.uniform1i(uniTexLocation[1], 1);

			// 複数タイル対応
		    gl.uniform1i(uniLocTileX, xx);
		    gl.uniform1i(uniLocTileY, yy);

			// 描画
			gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
			// gl.flush();

			order++;
		}
	}
}

// シェーダを生成する関数
function create_shader(id){
	// シェーダを格納する変数
	var shader;
	
	// HTMLからscriptタグへの参照を取得
	var scriptElement = document.getElementById(id);
	
	// scriptタグが存在しない場合は抜ける
	if(!scriptElement){return;}
	
	// scriptタグのtype属性をチェック
	switch(scriptElement.type){
		
		// 頂点シェーダの場合
		case 'x-shader/x-vertex':
			shader = gl.createShader(gl.VERTEX_SHADER);
			break;
			
		// フラグメントシェーダの場合
		case 'x-shader/x-fragment':
			shader = gl.createShader(gl.FRAGMENT_SHADER);
			break;
		default :
			return;
	}
	
	// 生成されたシェーダにソースを割り当てる
	gl.shaderSource(shader, scriptElement.text);
	
	// シェーダをコンパイルする
	gl.compileShader(shader);
	
	// シェーダが正しくコンパイルされたかチェック
	if(gl.getShaderParameter(shader, gl.COMPILE_STATUS)){
		
		// 成功していたらシェーダを返して終了
		return shader;
	}else{
		
		// 失敗していたらエラーログをアラートしコンソールに出力
		alert(gl.getShaderInfoLog(shader));
		console.log(gl.getShaderInfoLog(shader));
	}
}

// プログラムオブジェクトを生成しシェーダをリンクする関数
function create_program(vs, fs){
	// プログラムオブジェクトの生成
	var program = gl.createProgram();
	
	// プログラムオブジェクトにシェーダを割り当てる
	gl.attachShader(program, vs);
	gl.attachShader(program, fs);
	
	// シェーダをリンク
	gl.linkProgram(program);
	
	// シェーダのリンクが正しく行なわれたかチェック
	if(gl.getProgramParameter(program, gl.LINK_STATUS)){
	
		// 成功していたらプログラムオブジェクトを有効にする
		gl.useProgram(program);
		
		// プログラムオブジェクトを返して終了
		return program;
	}else{
		
		// 失敗していたら NULL を返す
		return null;
	}
}

// VBOを生成する関数
function create_vbo(data){
	// バッファオブジェクトの生成
	var vbo = gl.createBuffer();
	
	// バッファをバインドする
	gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
	
	// バッファにデータをセット
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
	
	// バッファのバインドを無効化
	gl.bindBuffer(gl.ARRAY_BUFFER, null);
	
	// 生成した VBO を返して終了
	return vbo;
}

// VBOをバインドし登録する関数
function set_attribute(vbo, attL, attS){
    // 引数として受け取った配列を処理する
    for(var i in vbo){
        // バッファをバインドする
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo[i]);
        
        // attributeLocationを有効にする
        gl.enableVertexAttribArray(attL[i]);
        
        // attributeLocationを通知し登録する
        gl.vertexAttribPointer(attL[i], attS[i], gl.FLOAT, false, 0, 0);
    }
}

// IBOを生成する関数
function create_ibo(data){
	// バッファオブジェクトの生成
	var ibo = gl.createBuffer();
	
	// バッファをバインドする
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
	
	// バッファにデータをセット
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Int16Array(data), gl.STATIC_DRAW);
	
	// バッファのバインドを無効化
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
	
	// 生成したIBOを返して終了
	return ibo;
}

// テクスチャを生成する関数
function create_texture(type, index, source){
    // イメージオブジェクトの生成
    var img = new Image();
    
    // データのオンロードをトリガーにする
    img.onload = function(){
        // テクスチャオブジェクトの生成
        var tex = gl.createTexture();
        
        // テクスチャをバインドする
        gl.bindTexture(gl.TEXTURE_2D, tex);
        
        // テクスチャへイメージを適用
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);

        // ミップマップを生成
        gl.generateMipmap(gl.TEXTURE_2D);
        // テクスチャパラメータの設定
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		// gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		// gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        
        // テクスチャのバインドを無効化
        gl.bindTexture(gl.TEXTURE_2D, null);
        
        // 生成したテクスチャをグローバル変数に代入
        if (type == 'A') {
	        texA[index] = tex;
        } else if (type == 'G') {
	        texG[index] = tex;
        }

		// テクスチャを反映するために再描画する
		render();
    };
    
    // クロスドメインリクエストを許可する
    img.crossOrigin = "Anonymous";
    // イメージオブジェクトのソースを指定
    img.src = source;
}
