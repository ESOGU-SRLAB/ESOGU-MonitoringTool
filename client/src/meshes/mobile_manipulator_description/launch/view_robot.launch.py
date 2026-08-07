#!/usr/bin/env python3

from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, IncludeLaunchDescription, ExecuteProcess
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.conditions import IfCondition
from launch.substitutions import LaunchConfiguration, PathJoinSubstitution, Command, FindExecutable
from launch_ros.actions import Node
from launch_ros.substitutions import FindPackageShare
import os
from launch_ros.parameter_descriptions import ParameterValue


def generate_launch_description():
    pkg_share = FindPackageShare('mobile_manipulator_description').find('mobile_manipulator_description')
    xacro_file = os.path.join(pkg_share, 'urdf', 'mobile_manipulator.urdf.xacro')
    urdf_output = os.path.join(pkg_share, 'urdf', 'mobile_manipulator.urdf')
    rviz_config = os.path.join(pkg_share, 'rviz', 'mobile_manipulator_description.rviz')

    gui_arg = DeclareLaunchArgument(
        'gui',
        default_value='true',
        description='Joint State Publisher GUI kullanılacak mı?'
    )

    # 🧩 Xacro dosyasını URDF'e dönüştür
    xacro_process = ExecuteProcess(
        cmd=['xacro', xacro_file, '-o', urdf_output],
        output='screen'
    )

    robot_description = {
    'robot_description': ParameterValue(
        Command([
            PathJoinSubstitution([FindExecutable(name='xacro')]),
            ' ',
            xacro_file
        ]),
        value_type=str,
    )
}

    joint_state_publisher_gui_node = Node(
        condition=IfCondition(LaunchConfiguration('gui')),
        package='joint_state_publisher_gui',
        executable='joint_state_publisher_gui',
        name='joint_state_publisher_gui',
        output='screen'
    )

    robot_state_publisher_node = Node(
        package='robot_state_publisher',
        executable='robot_state_publisher',
        name='robot_state_publisher',
        output='screen',
        parameters=[robot_description]
    )

    rviz_node = Node(
        package='rviz2',
        executable='rviz2',
        name='rviz2',
        output='screen',
        arguments=['-d', rviz_config],
        condition=IfCondition('true')
    )

    # Gazebo (ros_gz_sim)
    gz_sim_launch = IncludeLaunchDescription(
        PythonLaunchDescriptionSource([
            PathJoinSubstitution([
                FindPackageShare('ros_gz_sim'),
                'launch',
                'gz_sim.launch.py'
            ])
        ]),
        launch_arguments={'gz_args': '-v 4 empty.sdf'}.items(),
    )

    # 🚀 İşlenmiş URDF dosyasını spawn et
    spawn_entity = ExecuteProcess(
        cmd=[
            'ros2', 'run', 'ros_gz_sim', 'create',
            '-file', urdf_output,
            '-name', 'agv',
            '-z', '0.05'
        ],
        output='screen'
    )

    return LaunchDescription([
        gui_arg,
        xacro_process,                 # önce xacro’yu işle
        joint_state_publisher_gui_node,
        robot_state_publisher_node,
        rviz_node,
        # gz_sim_launch,
        # spawn_entity
    ])
