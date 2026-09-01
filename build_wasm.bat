call .\emsdk\emsdk_env.bat
em++ -O3 --bind -s WASM=1 -s ALLOW_MEMORY_GROWTH=1 -s MODULARIZE=1 -s EXPORT_ES6=1 -s EXPORT_NAME="createQpdfModule" -s USE_LIBJPEG=1 -s DYNAMIC_EXECUTION=0 -s ENVIRONMENT=web,worker -I./qpdf/include qpdf_wrapper.cpp ./qpdf/build/libqpdf/libqpdf.a ./zlib/build/libz.a -o qpdf_wrapper.js
