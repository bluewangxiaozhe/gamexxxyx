from playwright.sync_api import sync_playwright
import requests

def test_online_environment():
    print("=" * 60)
    print("测试线上环境")
    print("=" * 60)

    frontend_url = "https://gamexxxyx.pages.dev"
    api_url = "https://api.567zm.com/api"

    print(f"\n1. 测试前端网站: {frontend_url}")
    try:
        response = requests.get(frontend_url, timeout=10)
        print(f"   状态码: {response.status_code}")
        print(f"   内容长度: {len(response.text)} bytes")
    except Exception as e:
        print(f"   ❌ 前端访问失败: {e}")

    print(f"\n2. 测试 API 健康检查: {api_url}/health")
    try:
        response = requests.get(f"{api_url}/health", timeout=10)
        print(f"   状态码: {response.status_code}")
        print(f"   响应: {response.json()}")
    except Exception as e:
        print(f"   ❌ API 健康检查失败: {e}")

    print(f"\n3. 测试获取游戏列表: {api_url}/games")
    try:
        response = requests.get(f"{api_url}/games", timeout=10)
        print(f"   状态码: {response.status_code}")
        data = response.json()
        if isinstance(data, list):
            print(f"   游戏数量: {len(data)}")
            if len(data) > 0:
                print(f"   第一个游戏: {data[0].get('name', 'N/A')}")
        else:
            print(f"   响应类型: {type(data)}")
            print(f"   响应内容: {data}")
    except Exception as e:
        print(f"   ❌ 获取游戏列表失败: {e}")

    print("\n4. 使用 Playwright 测试前端页面")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        print(f"\n   访问: {frontend_url}")
        try:
            page.goto(frontend_url, timeout=30000)
            page.wait_for_load_state('networkidle', timeout=30000)
            print(f"   ✅ 页面加载成功")

            page.screenshot(path='D:/Ai/gamexxxyx-v2-local/test_screenshot.png', full_page=True)
            print(f"   📸 截图已保存: test_screenshot.png")

            title = page.title()
            print(f"   页面标题: {title}")

            page_HTML = page.content()
            if '暂无游戏' in page_HTML:
                print(f"   ⚠️ 页面显示 '暂无游戏' - API 可能未返回数据")
            elif '游戏' in page_HTML:
                print(f"   ✅ 页面包含游戏相关内容")
            else:
                print(f"   ℹ️ 页面内容需要进一步检查")

            console_logs = []
            page.on("console", lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))

            page.wait_for_timeout(3000)

            if console_logs:
                print(f"\n   控制台日志:")
                for log in console_logs[:10]:
                    print(f"     {log}")

        except Exception as e:
            print(f"   ❌ Playwright 测试失败: {e}")

        browser.close()

    print("\n" + "=" * 60)
    print("测试完成")
    print("=" * 60)

if __name__ == "__main__":
    test_online_environment()
