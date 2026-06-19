#!/usr/bin/env bash
# Terminate existing vllm serve processes if any
pkill -f 'vllm serve' || true

# Environment variables
export VLLM_USE_V2_MODEL_RUNNER=1
export CPATH=/home/g24tka12/include/python3.12:/home/g24tka12/include
export C_INCLUDE_PATH=/home/g24tka12/include/python3.12:/home/g24tka12/include
export CPLUS_INCLUDE_PATH=/home/g24tka12/include/python3.12:/home/g24tka12/include

# Start vLLM with DiffusionGemma FP8
nohup /home/g24tka12/.local/bin/vllm serve RedHatAI/diffusiongemma-26B-A4B-it-FP8-dynamic \
    --port 11444 \
    --trust-remote-code \
    --max-model-len 4096 \
    --gpu-memory-utilization 0.90 \
    --max-num-seqs 2 \
    --enforce-eager \
    --hf-overrides '{"diffusion_sampler": "entropy_bound", "diffusion_entropy_bound": 0.1}' \
    --default-chat-template-kwargs '{"enable_thinking": true}' > /home/g24tka12/vllm-diffusiongemma.log 2>&1 &

