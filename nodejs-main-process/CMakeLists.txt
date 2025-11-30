cmake_minimum_required(VERSION 3.15...3.31)
project(JSClang)

add_compile_definitions(NAPI_VERSION=4)

file(GLOB SOURCE_FILES "src/addonPT.cpp")

add_library(${PROJECT_NAME} SHARED ${SOURCE_FILES} ${CMAKE_JS_SRC})
set_target_properties(${PROJECT_NAME} PROPERTIES PREFIX "" SUFFIX ".node")
target_include_directories(${PROJECT_NAME} PRIVATE ${CMAKE_JS_INC})

# --- LibTorch includes & library ---
set(LIBTORCH_DIR "${CMAKE_SOURCE_DIR}/libtorch")
target_include_directories(${PROJECT_NAME} PRIVATE
    ${LIBTORCH_DIR}/include
    ${LIBTORCH_DIR}/include/torch/csrc/api/include
)

# Platform-specific library extensions
if(APPLE)
    set(TORCH_LIB_EXT ".dylib")
elseif(UNIX)
    set(TORCH_LIB_EXT ".so")
else()
    set(TORCH_LIB_EXT ".dll")
endif()

# Link LibTorch libraries (CPU only)
target_link_libraries(${PROJECT_NAME} PRIVATE
    "${CMAKE_JS_LIB}"
    "${LIBTORCH_DIR}/lib/libtorch${TORCH_LIB_EXT}"
    "${LIBTORCH_DIR}/lib/libtorch_cpu${TORCH_LIB_EXT}"
    "${LIBTORCH_DIR}/lib/libc10${TORCH_LIB_EXT}"
)

# Set rpath so dependencies in libtorch/lib are found at runtime
set_target_properties(${PROJECT_NAME} PROPERTIES
    INSTALL_RPATH "${LIBTORCH_DIR}/lib"
    BUILD_WITH_INSTALL_RPATH TRUE
)

target_compile_features(${PROJECT_NAME} PRIVATE cxx_std_17)

if(MSVC AND CMAKE_JS_NODELIB_DEF AND CMAKE_JS_NODELIB_TARGET)
  execute_process(COMMAND ${CMAKE_AR} /def:${CMAKE_JS_NODELIB_DEF} /out:${CMAKE_JS_NODELIB_TARGET} ${CMAKE_STATIC_LINKER_FLAGS})
endif()
