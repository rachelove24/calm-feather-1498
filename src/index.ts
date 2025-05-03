export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // API 路径，专门用于处理图片生成请求
    if (request.method === 'POST' && url.pathname === '/generate') {
      // 处理 POST 请求 (来自 JavaScript fetch)
      let formData;
      let prompt = "cute panda"; // 默认提示词
      try {
        // POST 请求现在发送 JSON
        const data: any = await request.json();
        if (data && typeof data.prompt === 'string' && data.prompt.trim() !== '') {
          prompt = data.prompt.trim();
        } else {
          console.log("Received empty or invalid prompt in JSON, using default.");
        }
      } catch (e) {
        console.error("Failed to parse JSON body:", e);
        return new Response(JSON.stringify({ error: '无效的请求数据' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }

      console.log(`Generating image with prompt: "${prompt}"`);

      try {
        // 调用 Cloudflare AI 服务
        const response = await env.AI.run(
          '@cf/stabilityai/stable-diffusion-xl-base-1.0',
          { prompt } // 直接使用解析出的 prompt
        );

        // 返回生成的图片
        return new Response(response, {
          headers: {
            'content-type': 'image/png',
            // 添加一个 header 告诉前端使用的 prompt，方便“重新生成”
            'X-Generated-Prompt': encodeURIComponent(prompt)
          },
        });
      } catch (e) {
        console.error("AI run failed:", e);
        // 返回 JSON 错误给前端 JavaScript
        return new Response(JSON.stringify({ error: 'AI 模型运行失败。' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }

    } else if (request.method === 'GET' && url.pathname === '/') {
      // 处理 GET 请求 (显示 HTML 页面)
      const html = `
<!DOCTYPE html>
<html>
<head>
  <title>AI 图片生成器</title>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: sans-serif; padding: 20px; display: flex; flex-direction: column; align-items: center; }
    #input-form { margin-bottom: 20px; display: flex; flex-direction: column; align-items: center; }
    label { margin-bottom: 5px; }
    input[type="text"] { width: 300px; padding: 8px; margin-bottom: 10px; }
    button { padding: 10px 15px; cursor: pointer; margin: 5px; }
    #loading { display: none; margin-top: 20px; }
    #result { margin-top: 20px; text-align: center; }
    #result img { max-width: 90%; display: block; margin: 10px auto; border: 1px solid #ccc; }
    #result-buttons { display: none; margin-top: 10px; }
    #error { color: red; margin-top: 10px; display: none; }
  </style>
</head>
<body>
  <h1>输入提示词生成图片</h1>

  <form id="input-form">
    <label for="prompt">提示词:</label>
    <input type="text" id="prompt" name="prompt" placeholder="例如：a happy cat sitting on a roof" required>
    <button type="submit">生成图片</button>
  </form>

  <div id="loading">正在生成图片，请稍候...</div>
  <div id="error"></div>

  <div id="result">
    <img id="generated-image" src="#" alt="生成的图片" style="display: none;">
    <div id="result-buttons">
      <button id="regenerate-button">重新生成(相同主题)</button>
      <button id="new-prompt-button">返回输入框</button>
    </div>
  </div>

  <script>
    const form = document.getElementById('input-form');
    const promptInput = document.getElementById('prompt');
    const loadingDiv = document.getElementById('loading');
    const resultDiv = document.getElementById('result');
    const resultImage = document.getElementById('generated-image');
    const resultButtons = document.getElementById('result-buttons');
    const regenerateButton = document.getElementById('regenerate-button');
    const newPromptButton = document.getElementById('new-prompt-button');
    const errorDiv = document.getElementById('error');

    let currentPrompt = ''; // 用于存储当前图片的提示词

    form.addEventListener('submit', (event) => {
      event.preventDefault(); // 阻止表单默认提交
      const userPrompt = promptInput.value.trim();
      if (userPrompt) {
        currentPrompt = userPrompt; // 保存当前提示词
        generateImage(currentPrompt);
      } else {
        showError('请输入有效的提示词。');
      }
    });

    regenerateButton.addEventListener('click', () => {
      if (currentPrompt) {
        generateImage(currentPrompt); // 使用保存的提示词重新生成
      }
    });

    newPromptButton.addEventListener('click', () => {
      // 隐藏结果，显示输入表单
      resultDiv.style.display = 'none';
      resultImage.style.display = 'none';
      resultButtons.style.display = 'none';
      errorDiv.style.display = 'none';
      form.style.display = 'flex'; // 确保表单可见
      promptInput.value = ''; // 清空输入框
      promptInput.focus();
    });

    async function generateImage(prompt) {
      // 隐藏表单和之前的错误/结果，显示加载提示
      form.style.display = 'none';
      resultDiv.style.display = 'block'; // 显示结果区域容器
      resultImage.style.display = 'none'; // 隐藏旧图片
      resultButtons.style.display = 'none'; // 隐藏按钮
      errorDiv.style.display = 'none'; // 隐藏旧错误
      loadingDiv.style.display = 'block'; // 显示加载提示

      try {
        const response = await fetch('/generate', { // 请求新的 /generate 路径
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ prompt: prompt }), // 发送 JSON 数据
        });

        loadingDiv.style.display = 'none'; // 隐藏加载提示

        if (response.ok && response.headers.get('content-type')?.includes('image/png')) {
          const imageBlob = await response.blob();
          const imageUrl = URL.createObjectURL(imageBlob);
          resultImage.src = imageUrl;
          resultImage.style.display = 'block'; // 显示新图片
          resultButtons.style.display = 'block'; // 显示按钮
          // 从 header 获取并解码 prompt，确保 regenerate 使用的是实际生成的 prompt
          const generatedPromptHeader = response.headers.get('X-Generated-Prompt');
          if (generatedPromptHeader) {
              currentPrompt = decodeURIComponent(generatedPromptHeader);
              // 可以选择更新输入框的值，但当前设计是隐藏输入框
              // promptInput.value = currentPrompt;
          }

        } else {
          // 处理错误情况，例如 AI 失败或返回非图片内容
          const errorData = await response.json().catch(() => ({ error: '无法解析错误响应' }));
          showError(errorData.error || \`生成失败，状态码: \${response.status}\`);
          // 显示返回按钮，以便用户可以重试或输入新提示
          resultButtons.style.display = 'block';
          regenerateButton.style.display = 'none'; // 失败时不显示重新生成
        }
      } catch (error) {
        console.error('Fetch error:', error);
        loadingDiv.style.display = 'none';
        showError('请求失败，请检查网络连接或稍后再试。');
         // 显示返回按钮
        resultButtons.style.display = 'block';
        regenerateButton.style.display = 'none'; // 失败时不显示重新生成
      }
    }

    function showError(message) {
      errorDiv.textContent = message;
      errorDiv.style.display = 'block';
      // 确保结果区域的其他部分被隐藏
      resultImage.style.display = 'none';
      loadingDiv.style.display = 'none';
    }

  </script>
</body>
</html>
      `;
      return new Response(html, {
        headers: {
          'content-type': 'text/html;charset=UTF-8',
        },
      });
    } else {
      // 处理其他方法或路径
      return new Response('未找到或不支持的方法', { status: 404 });
    }
  },
};

// 定义环境变量类型 (如果你的项目还没有)
interface Env {
  AI: any; // 你可以根据需要定义更具体的类型
}
