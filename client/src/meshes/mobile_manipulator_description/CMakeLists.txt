cmake_minimum_required(VERSION 3.8)
project(mobile_manipulator_description)

find_package(ament_cmake REQUIRED)
find_package(xacro REQUIRED)

# Derlenen kod yok, sadece description dosyalarını install ediyoruz
install(DIRECTORY
  urdf
  meshes
  config
  launch
  model
  worlds
  bridge
  DESTINATION share/${PROJECT_NAME}
)

ament_package()
