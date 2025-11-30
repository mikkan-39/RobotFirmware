#include <napi.h>
#include <torch/script.h>  // JIT module API
#include <torch/torch.h>   // Core tensor API

#include <vector>

torch::jit::script::Module model;  // global
bool modelLoaded = false;  // track if model is loaded

Napi::Value LoadModel(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 1 || !info[0].IsString()) {
    Napi::TypeError::New(env, "Expected model path as string")
        .ThrowAsJavaScriptException();
    return env.Null();
  }

  std::string modelPath = info[0].As<Napi::String>().Utf8Value();

  try {
    model = torch::jit::load(modelPath);
    modelLoaded = true;
    return Napi::Boolean::New(env, true);
  } catch (const c10::Error& e) {
    modelLoaded = false;
    Napi::Error::New(env, "Failed to load model: " + std::string(e.what()))
        .ThrowAsJavaScriptException();
    return env.Null();
  }
}

Napi::Value RunModel(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (!modelLoaded) {
    Napi::Error::New(env, "Model not loaded. Call loadModel() first.")
        .ThrowAsJavaScriptException();
    return env.Null();
  }

  Napi::Array inputArray = info[0].As<Napi::Array>();
  int inputSize = inputArray.Length();
  std::vector<float> inputVec;
  inputVec.reserve(inputSize);

  for (uint32_t i = 0; i < inputArray.Length(); ++i) {
    inputVec.push_back(inputArray.Get(i).As<Napi::Number>().FloatValue());
  }

  auto inputTensor =
      torch::from_blob(inputVec.data(), {1, inputSize}, torch::kFloat32)
          .clone();
  auto outputTensor = model.forward({inputTensor}).toTensor();

  int64_t outputSize = outputTensor.numel();
  Napi::Array result = Napi::Array::New(env, outputSize);
  auto data = outputTensor.data_ptr<float>();
  for (int64_t i = 0; i < outputSize; ++i) {
    result.Set(i, Napi::Number::New(env, data[i]));
  }

  return result;
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("loadModel", Napi::Function::New(env, LoadModel));
  exports.Set("runModel", Napi::Function::New(env, RunModel));
  return exports;
}

NODE_API_MODULE(jsclamp_test, Init)
