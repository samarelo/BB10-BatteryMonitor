BB10-BatteryMonitor
===================

Author: Shaun Amarelo

Description: A Battery monitoring application for BlackBerry 10 devices.

How to Use: 

  How to start monitoring
  
    From the Main pane, click on the Start button. This will start monitoring the battery life.

How to stop monitoring

    From the Main pane, click on the Stop  button. This will stop monitoring the battery life.

How to view history data

    From the Stats pane, all the data obtained by the application will be displayed under "Historical Stats"
    This data can be filter to provide more specific information.
      Current filtering includes, Filtering by Year, Month, Day. (Day is dependent on Month, Month is dependent on Year)

How it works:

  When clicking on the "Start" button a BlackBerry10 specific eventlistener is created to be notified whenever there is a change in the battery status on the device.
  
  Changes in the battery status may be one of the following:
  
    1. Change in charging state (device plugged into charger or unplugged)
    2. Change in battery level (battery drains or charges)
    
  Whenever a change in the battery status has been received the following information is obtained and stored to a Web SQL Database.
  The database has one table called 'stats' with the following columns.
  
    1. Integer ID: (Primary Key) ID for item
    
