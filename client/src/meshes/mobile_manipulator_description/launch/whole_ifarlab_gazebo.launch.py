import os
from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import (
    DeclareLaunchArgument,
    IncludeLaunchDescription,
    OpaqueFunction,
    RegisterEventHandler,
    SetEnvironmentVariable,
    GroupAction,
    TimerAction,
)
from launch.conditions import IfCondition, UnlessCondition
from launch.event_handlers import OnProcessExit
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import (
    Command,
    FindExecutable,
    LaunchConfiguration,
    PathJoinSubstitution,
    EnvironmentVariable,
)
from launch_ros.actions import Node, PushRosNamespace
from launch_ros.substitutions import FindPackageShare
from launch_ros.parameter_descriptions import ParameterValue


def launch_setup(context, *args, **kwargs):
    # ==================== Ortak Argümanlar ====================
    use_sim_time = LaunchConfiguration("use_sim_time", default="true")
    launch_rviz = LaunchConfiguration("launch_rviz")
    gazebo_gui = LaunchConfiguration("gazebo_gui")
    world_file = LaunchConfiguration("world_file")

    # ==================== UR10e Argümanları ====================
    ur_type = LaunchConfiguration("ur_type")
    ur_safety_limits = LaunchConfiguration("ur_safety_limits")
    ur_safety_pos_margin = LaunchConfiguration("ur_safety_pos_margin")
    ur_safety_k_position = LaunchConfiguration("ur_safety_k_position")
    ur_runtime_config_package = LaunchConfiguration("ur_runtime_config_package")
    ur_controllers_file = LaunchConfiguration("ur_controllers_file")
    ur_description_package = LaunchConfiguration("ur_description_package")
    ur_description_file = LaunchConfiguration("ur_description_file")
    ur_prefix = LaunchConfiguration("ur_prefix")
    ur_start_joint_controller = LaunchConfiguration("ur_start_joint_controller")
    ur_initial_joint_controller = LaunchConfiguration("ur_initial_joint_controller")
    ur_namespace = LaunchConfiguration("ur_namespace")

    # ==================== Kawasaki+AGV Argümanları ====================
    kawasaki_runtime_config_package = LaunchConfiguration("kawasaki_runtime_config_package")
    kawasaki_controllers_file = LaunchConfiguration("kawasaki_controllers_file")
    kawasaki_description_package = LaunchConfiguration("kawasaki_description_package")
    kawasaki_description_file = LaunchConfiguration("kawasaki_description_file")
    kawasaki_tf_prefix = LaunchConfiguration("kawasaki_tf_prefix")
    kawasaki_start_joint_controller = LaunchConfiguration("kawasaki_start_joint_controller")
    kawasaki_initial_joint_controller = LaunchConfiguration("kawasaki_initial_joint_controller")

    # ==================== Gazebo Ortam Değişkenleri ====================
    kawasaki_pkg_share = get_package_share_directory("mobile_manipulator_description")
    kawasaki_model_path = os.path.join(kawasaki_pkg_share, "model")
    kawasaki_share_root = os.path.dirname(kawasaki_pkg_share)

    set_ign_resource = SetEnvironmentVariable(
        name="IGN_GAZEBO_RESOURCE_PATH",
        value=[
            kawasaki_model_path, ":",
            kawasaki_share_root, ":",
            EnvironmentVariable("IGN_GAZEBO_RESOURCE_PATH", default_value=""),
        ],
    )

    set_gz_resource = SetEnvironmentVariable(
        name="GZ_SIM_RESOURCE_PATH",
        value=[
            kawasaki_model_path, ":",
            kawasaki_share_root, ":",
            EnvironmentVariable("GZ_SIM_RESOURCE_PATH", default_value=""),
        ],
    )

    # ==================== UR10e Robot Description ====================
    ur_initial_joint_controllers = PathJoinSubstitution(
        [FindPackageShare(ur_runtime_config_package), "config", ur_controllers_file]
    )

    ur_robot_description_content = Command(
        [
            PathJoinSubstitution([FindExecutable(name="xacro")]),
            " ",
            PathJoinSubstitution(
                [FindPackageShare(ur_description_package), "urdf", ur_description_file]
            ),
            " ",
            "safety_limits:=",
            ur_safety_limits,
            " ",
            "safety_pos_margin:=",
            ur_safety_pos_margin,
            " ",
            "safety_k_position:=",
            ur_safety_k_position,
            " ",
            "name:=",
            "ur10e",
            " ",
            "ur_type:=",
            ur_type,
            " ",
            "prefix:=",
            ur_prefix,
            " ",
            "sim_ignition:=true",
            " ",
            "simulation_controllers:=",
            ur_initial_joint_controllers,
            " ",
            "use_sim_time:=",
            use_sim_time,
        ]
    )
    ur_robot_description = {"robot_description": ur_robot_description_content}

    # ==================== Kawasaki+AGV Robot Description ====================
    kawasaki_initial_joint_controllers = PathJoinSubstitution(
        [FindPackageShare(kawasaki_runtime_config_package), "config", kawasaki_controllers_file]
    )

    kawasaki_robot_description_content = Command(
        [
            PathJoinSubstitution([FindExecutable(name="xacro")]),
            " ",
            PathJoinSubstitution(
                [FindPackageShare(kawasaki_description_package), "urdf", kawasaki_description_file]
            ),
            " ",
            "name:=",
            "rs005l",
            " ",
            "tf_prefix:=",
            kawasaki_tf_prefix,
            " ",
            "sim_ignition:=true",
            " ",
            "simulation_controllers:=",
            kawasaki_initial_joint_controllers,
            " ",
            "use_sim_time:=",
            use_sim_time,
        ]
    )
    kawasaki_robot_description = {
        "robot_description": ParameterValue(kawasaki_robot_description_content, value_type=str)
    }

    # ==================== Gazebo Başlatma ====================
    gz_launch_description_with_gui = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(
            [FindPackageShare("ros_gz_sim"), "/launch/gz_sim.launch.py"]
        ),
        launch_arguments={"gz_args": [" -r -v 4 ", world_file]}.items(),
        condition=IfCondition(gazebo_gui),
    )

    gz_launch_description_without_gui = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(
            [FindPackageShare("ros_gz_sim"), "/launch/gz_sim.launch.py"]
        ),
        launch_arguments={"gz_args": [" -s -r -v 4 ", world_file]}.items(),
        condition=UnlessCondition(gazebo_gui),
    )

    # ==================== UR10e Spawn ====================
    ur_gz_spawn_entity = Node(
        package="ros_gz_sim",
        executable="create",
        output="screen",
        arguments=[
            "-string",
            ur_robot_description_content,
            "-name",
            "ur10e",
            "-allow_renaming",
            "true",
            "-x", "0.0",
            "-y", "0.0",
            "-z", "0.0",
        ],
    )

    # ==================== Kawasaki+AGV Spawn (ÖNCE başlasın) ====================
    kawasaki_gz_spawn_entity = Node(
        package="ros_gz_sim",
        executable="create",
        output="screen",
        arguments=[
            "-string",
            kawasaki_robot_description_content,
            "-name",
            "mobile_manipulator",
            "-allow_renaming",
            "true",
            "-x", "-2.301949",
            "-y", "0.530401",
            "-z", "0.17",
            "-R", "0.0",
            "-P", "0.0",
            "-Y", "1.570796",
        ],
    )

    # ==================== UR10e Düğümleri (Namespace içinde) ====================
    ur_rviz_config_file = PathJoinSubstitution(
        [FindPackageShare(ur_description_package), "rviz", "whole_urdf.rviz"]
    )

    ur_robot_state_publisher_node = Node(
        package="robot_state_publisher",
        executable="robot_state_publisher",
        output="both",
        parameters=[{"use_sim_time": use_sim_time}, ur_robot_description],
    )

    ur_rviz_node = Node(
        package="rviz2",
        executable="rviz2",
        name="rviz2_ur",
        output="log",
        arguments=["-d", ur_rviz_config_file],
        parameters=[{"use_sim_time": use_sim_time}],
        condition=IfCondition(launch_rviz),
    )

    ur_joint_state_broadcaster_spawner = Node(
        package="controller_manager",
        executable="spawner",
        arguments=["sim_joint_state_broadcaster", "--controller-manager", "/sim/controller_manager"],
        parameters=[{"use_sim_time": use_sim_time}],
    )

    ur_delay_rviz = RegisterEventHandler(
        event_handler=OnProcessExit(
            target_action=ur_joint_state_broadcaster_spawner,
            on_exit=[ur_rviz_node],
        ),
        condition=IfCondition(launch_rviz),
    )

    ur_initial_joint_controller_spawner_started = Node(
        package="controller_manager",
        executable="spawner",
        arguments=[ur_initial_joint_controller, "-c", "/sim/controller_manager", "--inactive"],
        parameters=[{"use_sim_time": use_sim_time}],
        condition=IfCondition(ur_start_joint_controller),
    )

    ur_initial_joint_controller_spawner_stopped = Node(
        package="controller_manager",
        executable="spawner",
        arguments=[ur_initial_joint_controller, "-c", "/sim/controller_manager", "--stopped"],
        parameters=[{"use_sim_time": use_sim_time}],
        condition=UnlessCondition(ur_start_joint_controller),
    )

    ur_gz_sim_bridge = Node(
        package="ros_gz_bridge",
        executable="parameter_bridge",
        arguments=[
            "--ros-args",
            "-p",
            f"config_file:={os.path.join(get_package_share_directory('my_robot_cell_gz'), 'bridge', 'bridgos.yaml')}",
        ],
        output="screen",
    )

    ur_tf_installer = Node(
        package="tf2_ros",
        executable="static_transform_publisher",
        arguments=[
            "-0.038", "0.050", "0.055", "0.001", "0.707", "-0.001", "0.707",
            "ur10e_wrist_3_link", "ur/ur10e_wrist_3_link/ur10e_depth_optical_frame",
        ],
    )

    ur_base_launch = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(
            [
                PathJoinSubstitution([FindPackageShare("sim_robot_moveit_config"), "launch"]),
                "/move_group.launch.py",
            ]
        ),
        launch_arguments={
            "use_sim_time": "true",
            "namespace": ur_namespace,
        }.items(),
    )

    ur_linear_axis_adapter_node = Node(
        package="festo_edcon_ros2",
        executable="linear_axis_adapter.py",
        name="linear_axis_adapter_node",
        output="screen"
    )

    ur_real_to_sim_bridge_node = Node(
        package="my_robot_cell_control",
        executable="real_to_sim_bridge",
        name="real_to_sim_bridge",
        output="screen",
        parameters=[{"use_sim_time": use_sim_time}],
    )

    ur_nodes_in_namespace = GroupAction(
        actions=[
            PushRosNamespace(ur_namespace),
            ur_robot_state_publisher_node,
            ur_joint_state_broadcaster_spawner,
            ur_delay_rviz,
            ur_initial_joint_controller_spawner_stopped,
            ur_initial_joint_controller_spawner_started,
            ur_gz_sim_bridge,
            ur_tf_installer,
            ur_base_launch,
            ur_linear_axis_adapter_node,
            ur_real_to_sim_bridge_node,
        ]
    )

    # ==================== Kawasaki+AGV Düğümleri (Namespace içinde) ====================
    kawasaki_rviz_config_file = PathJoinSubstitution(
        [FindPackageShare(kawasaki_description_package), "rviz", "whole_urdf.rviz"]
    )

    kawasaki_robot_state_publisher_node = Node(
        package="robot_state_publisher",
        executable="robot_state_publisher",
        output="both",
        parameters=[{"use_sim_time": use_sim_time}, kawasaki_robot_description],
    )

    kawasaki_rviz_node = Node(
        package="rviz2",
        executable="rviz2",
        name="rviz2_kawasaki",
        output="log",
        arguments=["-d", kawasaki_rviz_config_file],
        parameters=[{"use_sim_time": use_sim_time}],
        condition=IfCondition(launch_rviz),
    )

    kawasaki_joint_state_broadcaster_spawner = Node(
        package="controller_manager",
        executable="spawner",
        arguments=["kawasaki_joint_state_broadcaster", "--controller-manager", "/kawasaki/controller_manager"],
        parameters=[{"use_sim_time": use_sim_time}],
    )

    kawasaki_delay_rviz = RegisterEventHandler(
        event_handler=OnProcessExit(
            target_action=kawasaki_joint_state_broadcaster_spawner,
            on_exit=[kawasaki_rviz_node],
        ),
        condition=IfCondition(launch_rviz),
    )

    kawasaki_initial_joint_controller_spawner_started = Node(
        package="controller_manager",
        executable="spawner",
        arguments=[kawasaki_initial_joint_controller, "-c", "/kawasaki/controller_manager"],
        parameters=[{"use_sim_time": use_sim_time}],
        condition=IfCondition(kawasaki_start_joint_controller),
    )

    kawasaki_initial_joint_controller_spawner_stopped = Node(
        package="controller_manager",
        executable="spawner",
        arguments=[kawasaki_initial_joint_controller, "-c", "/kawasaki/controller_manager", "--stopped"],
        parameters=[{"use_sim_time": use_sim_time}],
        condition=UnlessCondition(kawasaki_start_joint_controller),
    )

    # OTA Base Controller spawner
    ota_base_controller_spawner = Node(
        package="controller_manager",
        executable="spawner",
        arguments=["ota_base_controller", "-c", "/kawasaki/controller_manager"],
        parameters=[{"use_sim_time": use_sim_time}],
    )

    # AGV cmd_vel bridge: ROS /kawasaki/ota_base_controller/cmd_vel_unstamped <-> Gazebo /cmd_vel
    kawasaki_cmd_vel_bridge = Node(
        package="ros_gz_bridge",
        executable="parameter_bridge",
        arguments=[
            "/cmd_vel@geometry_msgs/msg/Twist@gz.msgs.Twist",
        ],
        remappings=[
            ("/cmd_vel", "/kawasaki/ota_base_controller/cmd_vel_unstamped"),
        ],
        output="screen",
    )

    # Gazebo'dan ROS'a TF bridge (diff_drive plugin odom->ota_base_link TF yayınlıyor)
    kawasaki_tf_bridge = Node(
        package="ros_gz_bridge",
        executable="parameter_bridge",
        arguments=[
            "/tf@tf2_msgs/msg/TFMessage[gz.msgs.Pose_V",
        ],
        output="screen",
    )

    # world -> odom static transform (spawn pozisyonuyla aynı)
    # Spawn: x=-2.301949, y=0.530401, z=0.17, Y=1.570796 (90 derece)
    kawasaki_world_to_odom_tf = Node(
        package="tf2_ros",
        executable="static_transform_publisher",
        arguments=[
            "-2.301949", "0.530401", "0.17",  # x, y, z
            "0", "0", "0.707107", "0.707107",  # qx, qy, qz, qw (yaw=90 derece)
            "world", "odom",
        ],
        output="screen",
    )

    kawasaki_moveit = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(
            [
                PathJoinSubstitution([FindPackageShare("kawasaki_moveit_config"), "launch"]),
                "/move_group.launch.py",
            ]
        ),
        launch_arguments={
            "use_sim_time": "true",
            "namespace": "/kawasaki",
        }.items(),
    )

    kawasaki_nodes_in_namespace = GroupAction(
        actions=[
            PushRosNamespace("/kawasaki"),
            kawasaki_robot_state_publisher_node,
            kawasaki_joint_state_broadcaster_spawner,
            kawasaki_delay_rviz,
            kawasaki_initial_joint_controller_spawner_stopped,
            kawasaki_initial_joint_controller_spawner_started,
            ota_base_controller_spawner,
            kawasaki_cmd_vel_bridge,
            kawasaki_moveit,
        ]
    )

    # Kawasaki controller'larını 2 saniye gecikmeli başlat (spawn'dan hemen sonra)
    delayed_kawasaki_controllers = TimerAction(
        period=2.0,
        actions=[kawasaki_nodes_in_namespace],
    )

    # UR tarafını 10 saniye gecikme ile (spawn + tüm düğümler) başlat
    delayed_ur_spawn_and_nodes = TimerAction(
        period=10.0,
        actions=[
            ur_gz_spawn_entity,
            ur_nodes_in_namespace,
        ],
    )

    # ==================== Başlatılacak Tüm Düğümler ====================
    nodes_to_start = [
        # Ortam değişkenleri
        set_ign_resource,
        set_gz_resource,

        # Gazebo başlat
        gz_launch_description_with_gui,
        gz_launch_description_without_gui,

        # Gazebo -> ROS TF bridge (odom -> ota_base_link için)
        kawasaki_tf_bridge,
        
        # world -> odom static transform (AGV başlangıç pozisyonu)
        kawasaki_world_to_odom_tf,

        # Önce Kawasaki tarafı
        kawasaki_gz_spawn_entity,
        delayed_kawasaki_controllers,

        # 10 sn sonra UR tarafı
        delayed_ur_spawn_and_nodes,
    ]

    return nodes_to_start


def generate_launch_description():
    declared_arguments = []

    # ==================== Ortak Argümanlar ====================
    declared_arguments.append(
        DeclareLaunchArgument(
            "use_sim_time",
            default_value="true",
            description="Use simulation time (true) or real time (false).",
        )
    )
    declared_arguments.append(
        DeclareLaunchArgument(
            "launch_rviz",
            default_value="true",
            description="Launch RViz?"
        )
    )
    declared_arguments.append(
        DeclareLaunchArgument(
            "gazebo_gui",
            default_value="true",
            description="Start gazebo with GUI?"
        )
    )
    declared_arguments.append(
        DeclareLaunchArgument(
            "world_file",
            default_value="/home/cem/colcon_ws/src/mobile_manipulator_description/worlds/ifarlab.sdf",
            description="Gazebo world file path.",
        )
    )

    # ==================== UR10e Argümanları ====================
    declared_arguments.append(
        DeclareLaunchArgument(
            "ur_type",
            default_value="ur10e",
            description="Type/series of used UR robot.",
            choices=["ur3", "ur3e", "ur5", "ur5e", "ur7e", "ur10", "ur10e", "ur12e", "ur16e", "ur15", "ur20", "ur30"],
        )
    )
    declared_arguments.append(
        DeclareLaunchArgument(
            "ur_safety_limits",
            default_value="true",
            description="Enables the safety limits controller if true.",
        )
    )
    declared_arguments.append(
        DeclareLaunchArgument(
            "ur_safety_pos_margin",
            default_value="0.15",
            description="The margin to lower and upper limits in the safety controller.",
        )
    )
    declared_arguments.append(
        DeclareLaunchArgument(
            "ur_safety_k_position",
            default_value="20",
            description="k-position factor in the safety controller.",
        )
    )
    declared_arguments.append(
        DeclareLaunchArgument(
            "ur_runtime_config_package",
            default_value="my_robot_cell_gz",
            description="Package with UR controller's configuration.",
        )
    )
    declared_arguments.append(
        DeclareLaunchArgument(
            "ur_controllers_file",
            default_value="simrobot_ur_controllers.yaml",
            description="YAML file with UR controllers configuration.",
        )
    )
    declared_arguments.append(
        DeclareLaunchArgument(
            "ur_description_package",
            default_value="my_robot_cell_description",
            description="Description package for UR robot.",
        )
    )
    declared_arguments.append(
        DeclareLaunchArgument(
            "ur_description_file",
            default_value="simrobot_my_robot_cell.urdf.xacro",
            description="URDF/XACRO description file for UR robot.",
        )
    )
    declared_arguments.append(
        DeclareLaunchArgument(
            "ur_prefix",
            default_value='""',
            description="Prefix of UR joint names.",
        )
    )
    declared_arguments.append(
        DeclareLaunchArgument(
            "ur_start_joint_controller",
            default_value="true",
            description="Start UR joint controller.",
        )
    )
    declared_arguments.append(
        DeclareLaunchArgument(
            "ur_initial_joint_controller",
            default_value="sim_scaled_joint_trajectory_controller",
            description="UR robot controller to start.",
        )
    )
    declared_arguments.append(
        DeclareLaunchArgument(
            "ur_namespace",
            default_value="/sim",
            description="Namespace for UR robot nodes.",
        )
    )

    # ==================== Kawasaki+AGV Argümanları ====================
    declared_arguments.append(
        DeclareLaunchArgument(
            "kawasaki_runtime_config_package",
            default_value="mobile_manipulator_description",
            description="Package with Kawasaki controller's configuration.",
        )
    )
    declared_arguments.append(
        DeclareLaunchArgument(
            "kawasaki_controllers_file",
            default_value="ns_rs005l_controllers.yaml",
            description="YAML file with Kawasaki controllers configuration.",
        )
    )
    declared_arguments.append(
        DeclareLaunchArgument(
            "kawasaki_description_package",
            default_value="mobile_manipulator_description",
            description="Description package for Kawasaki robot.",
        )
    )
    declared_arguments.append(
        DeclareLaunchArgument(
            "kawasaki_description_file",
            default_value="mobile_manipulator.urdf.xacro",
            description="URDF/XACRO description file for Kawasaki robot.",
        )
    )
    declared_arguments.append(
        DeclareLaunchArgument(
            "kawasaki_tf_prefix",
            default_value='""',
            description="TF prefix for Kawasaki robot.",
        )
    )
    declared_arguments.append(
        DeclareLaunchArgument(
            "kawasaki_start_joint_controller",
            default_value="true",
            description="Start Kawasaki joint controller.",
        )
    )
    declared_arguments.append(
        DeclareLaunchArgument(
            "kawasaki_initial_joint_controller",
            default_value="kawasaki_controller",
            description="Kawasaki robot controller to start.",
        )
    )

    return LaunchDescription(declared_arguments + [OpaqueFunction(function=launch_setup)])
