#!/usr/bin/env python3

from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, GroupAction
from launch.conditions import IfCondition
from launch.substitutions import (
    Command,
    FindExecutable,
    LaunchConfiguration,
    PathJoinSubstitution,
)
from launch_ros.actions import Node, PushRosNamespace
from launch_ros.substitutions import FindPackageShare
from launch_ros.parameter_descriptions import ParameterValue
import os


def generate_launch_description():
    # Launch arguments
    gui_arg = DeclareLaunchArgument(
        'gui',
        default_value='true',
        description='Joint State Publisher GUI kullanılacak mı?'
    )

    # =================================================================================================
    # --- UR10e ROBOT (robot1 namespace) ---
    # =================================================================================================
    ur10e_pkg = FindPackageShare("my_robot_cell_description")
    ur10e_xacro = PathJoinSubstitution([ur10e_pkg, "urdf", "my_robot_cell.urdf.xacro"])
    
    ur10e_description_content = ParameterValue(
        Command([
            PathJoinSubstitution([FindExecutable(name="xacro")]), " ",
            ur10e_xacro, " ",
            "ur_type:=ur10e", " ",
            "tf_prefix:=robot1_",
        ]),
        value_type=str
    )

    robot1_group = GroupAction(
        actions=[
            PushRosNamespace('robot1'),
            Node(
                package="robot_state_publisher",
                executable="robot_state_publisher",
                output="both",
                parameters=[{"robot_description": ur10e_description_content}],
            ),
            Node(
                condition=IfCondition(LaunchConfiguration('gui')),
                package="joint_state_publisher_gui",
                executable="joint_state_publisher_gui",
            ),
        ]
    )

    # =================================================================================================
    # --- MOBILE MANIPULATOR (robot2 namespace) ---
    # =================================================================================================
    mobile_pkg_share = FindPackageShare('mobile_manipulator_description').find('mobile_manipulator_description')
    mobile_xacro = os.path.join(mobile_pkg_share, 'urdf', 'mobile_manipulator.urdf.xacro')
    
    mobile_description_content = ParameterValue(
        Command([
            PathJoinSubstitution([FindExecutable(name='xacro')]), " ",
            mobile_xacro, " ",
            "tf_prefix:=robot2_",
        ]),
        value_type=str
    )

    robot2_group = GroupAction(
        actions=[
            PushRosNamespace('robot2'),
            Node(
                package='robot_state_publisher',
                executable='robot_state_publisher',
                output="both",
                parameters=[{"robot_description": mobile_description_content}],
            ),
            Node(
                condition=IfCondition(LaunchConfiguration('gui')),
                package='joint_state_publisher_gui',
                executable='joint_state_publisher_gui',
            ),
        ]
    )

    # =================================================================================================
    # --- WORLD FRAME PUBLISHER (İki robotu birbirine bağlamak için) ---
    # =================================================================================================
    # Bu node, world frame'ini yayınlar ve her iki robotun base frame'ini ona bağlar
    static_tf_node = Node(
        package='tf2_ros',
        executable='static_transform_publisher',
        name='world_to_robots',
        arguments=[
            # world -> robot1_base_link
            '0', '0', '0', '0', '0', '0', 'world', 'robot1_base_link',
        ],
        output='screen'
    )
    
    # Robot2'yi robot1'in yanına yerleştirmek için (örneğin 2 metre sağında)
    static_tf_robot2 = Node(
        package='tf2_ros',
        executable='static_transform_publisher',
        name='world_to_robot2',
        arguments=[
            # x, y, z, roll, pitch, yaw, parent_frame, child_frame
            '2', '0', '0', '0', '0', '0', 'world', 'robot2_base_link',
        ],
        output='screen'
    )

    # =================================================================================================
    # --- RVIZ ---
    # =================================================================================================
    rviz_config = PathJoinSubstitution([ur10e_pkg, "rviz", "kawasaki_ur10e_urdf.rviz"])
    
    rviz_node = Node(
        package="rviz2",
        executable="rviz2",
        name="rviz2",
        output="screen",
        arguments=["-d", rviz_config],
    )

    return LaunchDescription([
        gui_arg,
        static_tf_node,
        static_tf_robot2,
        robot1_group,
        robot2_group,
        rviz_node
    ])