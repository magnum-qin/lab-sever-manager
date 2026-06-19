import json, urllib.request

data = json.dumps({
    "model": "RedHatAI/diffusiongemma-26B-A4B-it-FP8-dynamic",
    "messages": [{"role": "user", "content": "Say hello in one sentence."}],
    "max_tokens": 64
}).encode()

req = urllib.request.Request(
    "http://127.0.0.1:11444/v1/chat/completions",
    data=data,
    headers={"Content-Type": "application/json"}
)

resp = urllib.request.urlopen(req, timeout=120)
result = json.loads(resp.read().decode())
print(json.dumps(result, indent=2, ensure_ascii=False))
