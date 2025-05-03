export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // 检查请求方法
    if (request.method === 'POST') {
      // 处理 POST 请求 (表单提交)
      let formData;
      let prompt = "cute panda"; // 默认提示词
      try {
        formData = await request.formData();
        const userPrompt = formData.get('prompt');
        if (userPrompt && typeof userPrompt === 'string' && userPrompt.trim() !== '') {
          prompt = userPrompt.trim();
        } else {
          // 如果用户提交了空内容，可以返回错误或使用默认值
          console.log("User submitted empty prompt, using default.");
        }
      } catch (e) {
        console.error("Failed to parse form data:", e);
        // 如果解析表单数据失败，也使用默认值或返回错误
      }

      // 定义 AI 模型的输入
      const inputs = {
        prompt: prompt, // 使用从表单获取或默认的提示词
      };

      console.log(`Generating image with prompt: "${prompt}"`);

      try {
        // 调用 Cloudflare AI 服务
        const response = await env.AI.run(
          '@cf/stabilityai/stable-diffusion-xl-base-1.0',
          inputs
        );

        // 返回生成的图片
        return new Response(response, {
          headers: {
            'content-type': 'image/png',
          },
        });
      } catch (e) {
        console.error("AI run failed:", e);
        return new Response('AI 模型运行失败。', { status: 500 });
      }

    } else if (request.method === 'GET') {
      // 处理 GET 请求 (显示 HTML 表单)
      const html = `
<!DOCTYPE html>
<html>
<head>
  <title>AI 图片生成器</title>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: sans-serif; padding: 20px; }
    form { margin-bottom: 20px; }
    label { display: block; margin-bottom: 5px; }
    input[type="text"] { width: 300px; padding: 8px; margin-bottom: 10px; }
    button { padding: 10px 15px; cursor: pointer; }
  </style>
</head>
<body>
  <h1>输入提示词生成图片</h1>
  <form method="POST">
    <label for="prompt">提示词:</label>
    <input type="text" id="prompt" name="prompt" placeholder="例如：a happy cat sitting on a roof" required>
    <button type="submit">生成图片</button>
  </form>
  <p>注意：生成图片可能需要一些时间。提交后，浏览器将直接显示生成的图片。</p>
</body>
</html>
      `;
      return new Response(html, {
        headers: {
          'content-type': 'text/html;charset=UTF-8',
        },
      });
    } else {
      // 处理其他方法 (例如 HEAD)
      return new Response('不支持的方法', { status: 405 });
    }
  },
};

// 定义环境变量类型 (如果你的项目还没有)
interface Env {
  AI: any; // 你可以根据需要定义更具体的类型
}
